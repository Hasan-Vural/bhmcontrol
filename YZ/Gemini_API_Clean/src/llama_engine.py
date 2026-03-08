import os
import re
import chromadb
import ollama
import base64
from io import BytesIO
import pypdfium2 as pdfium
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from dotenv import load_dotenv
from src.config import VECTOR_DB_PATH, DATA_RAW
from src.logger import get_logger

# ---------------------------------------------------------
# SİSTEM AYARLARI VE GLOBAL DEĞİŞKENLER
# ---------------------------------------------------------
load_dotenv()
logger = get_logger("OfflineVisionRAG")

bm25 = None
bm25_corpus = []
bm25_metadata = []
embedding_model = None

VISION_MODEL = "llava:7b"

def pils_to_base64(pil_images):
    b64_list = []
    for pil_image in pil_images:
        if pil_image.mode == 'RGBA':
            pil_image = pil_image.convert('RGB')
        
        # DOWNSIZING OPTIMIZATION
        # Huge images (like 2000x3000 PDF scans) freeze local Ollama Vision models
        # We enforce a maximum dimension (e.g., 768x768) while maintaining aspect ratio
        pil_image.thumbnail((768, 768))
            
        buffered = BytesIO()
        pil_image.save(buffered, format="JPEG", quality=85)
        b64_list.append(base64.b64encode(buffered.getvalue()).decode("utf-8"))
    return b64_list

# ---------------------------------------------------------
# 1. MOTOR BAŞLATMA (VERİTABANI VE BM25 YÜKLEME)
# ---------------------------------------------------------
def initialize_search_engines():
    global bm25, bm25_corpus, bm25_metadata, embedding_model
    logger.info("⚙️ Arama motorları hazırlanıyor (Offline)...")

    try:
        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection(name="bakim_dokumanlari")

        existing_data = collection.get()
        documents = existing_data['documents']
        metadatas = existing_data['metadatas']

        if documents:
            tokenized_corpus = [re.findall(r'\w+', doc.lower()) for doc in documents]
            bm25 = BM25Okapi(tokenized_corpus)
            bm25_corpus = documents
            bm25_metadata = metadatas
            
            logger.info("🧠 Embedding modeli yükleniyor (Global)...")
            embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            
            logger.info(f"✅ Motor hazır! Toplam taranabilir parça: {len(documents)}")
    except Exception as e:
        logger.error(f"Başlatma hatası: {e}")

# ---------------------------------------------------------
# 2. YAPAY ZEKA YÖNLENDİRİCİSİ (OFFLINE AGENTIC ROUTER)
# ---------------------------------------------------------
def agentic_router(current_query, chat_history):
    history_text = "Sohbet yeni başlıyor."
    if chat_history:
        history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history[-4:]])

    prompt = f"""Sen endüstriyel bir makine bakım asistanının NLP (Doğal Dil İşleme) yönlendiricisisin.

KATEGORİ TANIMLARI:
- Elektrik: Güç devreleri, elektromekanik elemanlar, sensörler, panolar.
- Akümülatör: Basınçlı gaz sistemleri, akümülatör yedek parçaları.
- Yağlama: Hidrolik devreler, filtreler.
- Arayüz ve Kontrol: HMI, yazılım menüleri.
- Yedek Parça: Komponent siparişi, stok numaraları.
- Kullanım Kılavuzu: Genel mekanik, çalışma prensipleri, genel basınç/hacim özellikleri.

🛠️ NLP OPTİMİZASYON KURALLARI:
1. HAFIZA: SON SORU'daki belirsiz ifadeleri (o, bu) GEÇMİŞ SOHBET'teki kodlarla değiştir.
2. SADELEŞTİRME: Gereksiz soru kelimelerini sil. Sayfa numarası varsa ASLA SİLME (Örn: Sayfa 99 YV318).
3. ÇOKLU KATEGORİ: Eğer soru spesifik bir parça VE makinenin genel sistemini aynı anda ilgilendiriyorsa, virgülle ayırarak EN FAZLA 2 kategori seç. Aksi halde tek kategori seç.

GEÇMİŞ SOHBET:
{history_text}

SON SORU: {current_query}

ÇIKTI FORMATI:
KATEGORİLER: [Virgülle ayrılmış kategori adları. Örn: Akümülatör, Kullanım Kılavuzu VEYA sadece Elektrik]
SORU: [Sadeleştirilmiş Lazer Sorgu]
"""

    try:
        from ollama import Client
        # Sonsuz döngüleri ve takılmaları önlemek için 90 saniyelik timeout süresi
        router_client = Client(host='http://localhost:11434', timeout=90.0)
        
        response = router_client.chat(
            model=VISION_MODEL, 
            messages=[{'role': 'user', 'content': prompt}],
            options={
                "temperature": 0.1,
                "repeat_penalty": 1.1,
                "top_k": 40,
                "top_p": 0.9
            }
        )
        result = response['message']['content'].strip()

        cat_match = re.search(r'KATEGORİLER:\s*(.*)', result, re.IGNORECASE)
        q_match = re.search(r'SORU:\s*(.*)', result, re.IGNORECASE)

        categories = [c.strip() for c in cat_match.group(1).split(',')] if cat_match else ["Kullanım Kılavuzu"]
        new_query = q_match.group(1).strip() if q_match else current_query

        logger.info(f"🧠 Offline Router -> Kategoriler: {categories} | Hedef Soru: [{new_query}]")
        return categories, new_query
    except Exception as e:
        logger.error(f"Router Hatası: {e}")
        return ["Kullanım Kılavuzu"], current_query

# ---------------------------------------------------------
# 3. HİBRİT ARAMA MOTORU (ROUTER + ALTIN SKOR + RRF)
# ---------------------------------------------------------
def hybrid_search(query_text, target_categories=None, n_results=8, apply_filter=True):
    pool_size = 20
    rrf_k = 60
    doc_ranks = {}

    where_clause = None
    if apply_filter and target_categories and "Tümü" not in target_categories:
        where_clause = {"kategori": {"$in": target_categories}}
        logger.info(f"🎯 Kategori Filtresi Aktif: {target_categories}")

    try:
        global embedding_model
        if embedding_model is None:
            embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            
        query_embedding = embedding_model.encode([query_text]).tolist()

        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection(name="bakim_dokumanlari")

        vector_results = collection.query(query_embeddings=query_embedding, n_results=pool_size, where=where_clause)

        if vector_results['documents']:
            for rank, (doc, meta) in enumerate(zip(vector_results['documents'][0], vector_results['metadatas'][0])):
                unique_id = f"{meta.get('source')}_{meta.get('page')}"
                doc_ranks[unique_id] = {
                    "vector_rank": rank + 1,
                    "bm25_rank": 999,
                    "meta": meta,
                    "parent_text": meta.get('parent_text', doc)
                }
    except Exception as e:
        logger.error(f"Vektör hatası: {e}")

    try:
        if bm25:
            tokenized_query = re.findall(r'\w+', query_text.lower())
            bm25_scores = bm25.get_scores(tokenized_query)

            top_n_idx = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:pool_size]

            for rank, idx in enumerate(top_n_idx):
                score = bm25_scores[idx]
                if score > 0.1:
                    meta = bm25_metadata[idx]

                    is_in_category = True
                    if apply_filter and target_categories and "Tümü" not in target_categories:
                        if meta.get('kategori') not in target_categories:
                            is_in_category = False

                    if not is_in_category:
                        if score > 5.0:
                            logger.info(f"🚀 ALTIN SKOR! Kategori Duvarı Yıkıldı: {meta.get('kategori')} (Skor: {score:.2f})")
                        else:
                            continue

                    unique_id = f"{meta.get('source')}_{meta.get('page')}"
                    if unique_id in doc_ranks:
                        doc_ranks[unique_id]["bm25_rank"] = rank + 1
                    else:
                        doc_ranks[unique_id] = {
                            "vector_rank": 999,
                            "bm25_rank": rank + 1,
                            "meta": meta,
                            "parent_text": meta.get('parent_text', bm25_corpus[idx])
                        }
    except Exception as e:
        logger.error(f"BM25 hatası: {e}")

    final_results = []
    for unique_id, data in doc_ranks.items():
        vector_score = 1.0 / (rrf_k + data["vector_rank"])
        bm25_score = 1.0 / (rrf_k + data["bm25_rank"])
        total_rrf_score = (vector_score * 0.3) + (bm25_score * 0.7)

        final_results.append({
            "parent_text": data["parent_text"],
            "meta": data["meta"],
            "rrf_score": total_rrf_score,
            "type": f"RRF (Vektör:{data['vector_rank']} | BM25:{data['bm25_rank']})"
        })

    return sorted(final_results, key=lambda x: x["rrf_score"], reverse=True)[:n_results]

# ---------------------------------------------------------
# 4. GÖRSEL ÇIKARIM VE ÜRETİM (MULTIMODAL GENERATION)
# ---------------------------------------------------------
def get_page_image(pdf_filename, page_number):
    pdf_path = os.path.join(DATA_RAW, pdf_filename)
    try:
        pdf = pdfium.PdfDocument(pdf_path)
        bitmap = pdf[int(page_number) - 1].render(scale=2)
        return bitmap.to_pil()
    except Exception:
        return None

def generate_answer_with_vision(query, images, references, chat_history):
    history_context = ""
    if chat_history:
        history_context = "SOHBET GEÇMİŞİ:\n" + "\n".join(
            [f"- {msg['role']}: {msg['text'][:150]}..." for msg in chat_history[-2:]])

    system_prompt = """Sen endüstriyel makine tamiri yapan katı bir Bakım Başmühendisisin.
GÖREVİN: "REFERANSLAR" metnini oku ve "SORU"ya Türkçe cevap ver. 

KESİN KURALLAR:
1. DOKÜMANA MUTLAK SADAKAT: SADECE sana verilen REFERANSLAR bölümündeki bilgileri kullan. Referanslarda yazmayan bir sayıyı veya uyarıyı KESİNLİKLE uydurma.
2. NET CEVAP VER: Hikaye anlatma. Özetleme yapma. Sadece sorunun cevabını ver ve dur.
3. BİLGİ YOKSA: Eğer referanslarda sorunun cevabı yoksa SADECE "Dokümanlarda bu bilgiye rastlamadım." yaz.

REFERANSLAR:
{references}
"""

    user_prompt = f"""{history_context}
SORU: {query}"""

    try:
        b64_images = pils_to_base64(images) if images else []
        messages = [
            {'role': 'system', 'content': system_prompt.replace('{references}', references)},
            {'role': 'user', 'content': user_prompt}
        ]
        
        if b64_images:
            # Attach images to the user message
            messages[1]['images'] = b64_images

        print(f"\n💡 [DEBUG] Sending request to Ollama using model {VISION_MODEL}...")
        
        # Setting a custom client to enforce timeouts when Ollama freezes locally
        # Artan (60 -> 300 sn) CPU dostu timeout süresi
        from ollama import Client
        client = Client(host='http://localhost:11434', timeout=300.0)
        
        response = client.chat(
            model=VISION_MODEL, 
            messages=messages, 
            stream=False,
            options={
                "temperature": 0.0,
                "top_k": 10,
                "top_p": 0.5,
                "num_predict": 512
            }
        )
        print(f"💡 [DEBUG] Request finished.")
        return response['message']['content']
            
    except Exception as e:
        print(f"\n❌ [DEBUG ERROR] Model Hatası: {str(e)}")
        return f"\n[Sistem Hatası: Lokal model yanıt vermeyi kesti. (GPU/RAM sınırlarına ulaşılmış olabilir)] Detay: {str(e)}"

# ---------------------------------------------------------
# ANA DÖNGÜ (CLI INTERFACE)
# ---------------------------------------------------------
def main():
    initialize_search_engines()
    print("\n" + "=" * 60)
    print("🚀 OFFLINE MÜHENDİS AI (%100 GİZLİLİK) HAZIR!")
    print(f"👁️‍🗨️ Vizyon Modeli: {VISION_MODEL}")
    print("=" * 60 + "\n")

    chat_history = []

    while True:
        raw_query = input("\nSoru (Çıkış: 'q'): ")
        if not raw_query.strip(): continue
        if raw_query.lower() == 'q': break

        target_categories, search_query = agentic_router(raw_query, chat_history)

        logger.info("🔍 Lokal Veritabanı (RRF) taranıyor...")
        results = hybrid_search(search_query, target_categories, n_results=8, apply_filter=True)

        if not results:
            logger.warning("⚠️ Kategori ve Altın Skor boş döndü. B Planı (Tüm Veritabanı) devrede...")
            results = hybrid_search(search_query, target_categories=None, n_results=8, apply_filter=False)

        if not results:
            print("❌ Tüm veritabanı tarandı ancak ilgili doküman bulunamadı.")
            continue

        images_to_send = []
        reference_text = ""

        print("\n📚 BULUNAN REFERANS SAYFALAR:")
        for item in results:
            source = item['meta'].get('source', 'Bilinmiyor')
            page = item['meta'].get('page', 0)
            print(f"   🔹 [{item['meta'].get('kategori', 'Genel')}] {source} (Sayfa: {page}) -> {item['type']}")
            reference_text += f"\n--- KAYNAK: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
            if len(images_to_send) < 1:
                if img := get_page_image(source, page): images_to_send.append(img)

        logger.info(f"🤖 Llama ({VISION_MODEL}) görselleri analiz ediyor...")
        answer = generate_answer_with_vision(raw_query, images_to_send, reference_text, chat_history)
        print(answer)
        print("-" * 60)

        chat_history.append({"role": "Mühendis", "text": raw_query})
        chat_history.append({"role": "AI Asistan", "text": answer})
        if len(chat_history) > 6: chat_history = chat_history[-6:]

if __name__ == "__main__":
    main()
