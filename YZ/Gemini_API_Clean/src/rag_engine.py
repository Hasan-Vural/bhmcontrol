import os
import re
import chromadb
import google.generativeai as genai
import pypdfium2 as pdfium
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from dotenv import load_dotenv
from src.config import VECTOR_DB_PATH, DATA_RAW
from src.logger import get_logger
from tenacity import retry, wait_random_exponential, stop_after_attempt, retry_if_exception_type

# ---------------------------------------------------------
# SİSTEM AYARLARI VE GLOBAL DEĞİŞKENLER
# ---------------------------------------------------------
load_dotenv()
logger = get_logger(__name__)

api_keys_str = os.getenv("GOOGLE_API_KEY")
api_keys = [k.strip() for k in api_keys_str.split(',')] if api_keys_str else []

if not api_keys:
    logger.error("❌ GOOGLE_API_KEY bulunamadı! Lütfen .env dosyanızı kontrol edin.")
else:
    logger.info(f"🔑 {len(api_keys)} adet Google API Anahtarı yüklendi. Yük dengelemesi aktif.")
    genai.configure(api_key=api_keys[0]) # Start with the first one

current_key_idx = 0

def get_next_api_key():
    global current_key_idx
    if len(api_keys) > 1:
        current_key_idx = (current_key_idx + 1) % len(api_keys)
        new_key = api_keys[current_key_idx]
        genai.configure(api_key=new_key)
        logger.warning(f"🔄 API Limiti aşıldı! Yedek anahtara geçiliyor... (Anahtar #{current_key_idx + 1})")
        return new_key
    return None

bm25 = None
bm25_corpus = []
bm25_metadata = []
embedding_model = None


# ---------------------------------------------------------
# 1. MOTOR BAŞLATMA (VERİTABANI VE BM25 YÜKLEME)
# ---------------------------------------------------------
def initialize_search_engines():
    """ChromaDB (Vektör), BM25 (Kelime Avcısı) ve Embedding motorlarını ayağa kaldırır."""
    global bm25, bm25_corpus, bm25_metadata, embedding_model
    logger.info("⚙️ Arama motorları hazırlanıyor...")

    try:
        from sentence_transformers import SentenceTransformer
        embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        
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
            logger.info(f"✅ Motor hazır! Toplam taranabilir parça: {len(documents)}")
    except Exception as e:
        logger.error(f"Başlatma hatası: {e}")

# ---------------------------------------------------------
# YENİ: HATA KODU DOĞRULAMA (AKILLI KONTROL)
# ---------------------------------------------------------
def hata_kodu_dogrula(hata_kodu: str) -> dict:
    """
    Girilen hata kodunun veya serbest etiketin (# ile başlayan) PDF dokümanlarında geçip geçmediğini kontrol eder.
    Sadece ana dokümanlar taranır. bm25_corpus global değişkenini kullanarak hızlı arama yapar.
    """
    if not hata_kodu or not hata_kodu.strip():
        return {"gecerli": False, "mesaj": "❌ Kod/etiket boş bırakılamaz."}

    giriş = hata_kodu.strip()

    if bm25_corpus is None or len(bm25_corpus) == 0:
        initialize_search_engines()
        if bm25_corpus is None or len(bm25_corpus) == 0:
            return {"gecerli": True, "mesaj": "⚠️ Doküman koleksiyonu bellekte bulunamadı, sistem onaylıyor."}

    # SERBEST ETİKET MODU (#PRESS-DURMA)
    if giriş.startswith("#"):
        etiket = giriş[1:].strip()
        if not etiket:
            return {"gecerli": False, "mesaj": "❌ '#' işaretinden sonra etiket yazılmalıdır."}
            
        kelimeler = [k.upper() for k in re.split(r'[-_]', etiket) if k]
        bulunan = []
        for kelime in kelimeler:
            for doc_text in bm25_corpus:
                if kelime in doc_text.upper():
                    bulunan.append(kelime)
                    break 

        if bulunan:
            logger.info(f"✅ Serbest etiket doğrulandı: {giriş}")
            return {"gecerli": True, "mesaj": f"✅ '{giriş}' doğrulandı. (Dokümanda bulunan: {', '.join(bulunan)})"}
        else:
            return {"gecerli": False, "mesaj": f"❌ '{giriş}' etiketi doğrulanamadı.\nAranan kelimeler: {', '.join(kelimeler)}\nBunların hiçbiri PDF dokümanlarında bulunamadı."}

    # NORMAL KOD MODU
    kod = giriş.upper()
    for doc_text in bm25_corpus:
        if kod in doc_text.upper():
            logger.info(f"✅ Hata kodu doğrulandı: [{kod}] dokümanlarda bulundu.")
            return {"gecerli": True, "mesaj": f"✅ '{kod}' doğrulandı."}

    return {"gecerli": False, "mesaj": f"❌ '{kod}' hiçbir PDF dokümanında bulunamadı.\nYalnızca dokümanlarda geçen kodlar için çözüm kaydedilebilir."}

# ---------------------------------------------------------
# YENİ: ŞİRKET HAFIZASI EKLEME (CHROMA DB)
# ---------------------------------------------------------
def add_to_chroma(hata_kodu, title, description, isg_checks, ekipman, author):
    """Yeni onaylanan saha çözümünü ChromaDB vektör uzayına gömer."""
    try:
        if embedding_model is None:
            initialize_search_engines()
            
        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection(name="bakim_dokumanlari")
        
        # Benzersiz ID oluştur
        import uuid
        from datetime import datetime
        doc_id = f"saha_cozumu_{uuid.uuid4().hex[:8]}"
        tarih = datetime.now().strftime("%Y-%m-%d %H:%M")
        kod_temiz = hata_kodu.strip().upper()
        
        # ŞİRKET HAFIZASI FORMATI (Vektöre Gömülecek Tam Metin)
        full_text = (
            f"[✅ DOĞRULANMIŞ SAHA ÇÖZÜMÜ — {tarih} | "
            f"Kaydeden: {author} | Ekipman: {ekipman}]\n"
            f"HATA KODU: {kod_temiz}\n"
            f"PROBLEM: {title}\n"
            f"İSG Kuralları: {isg_checks}\n"
            f"ÇÖZÜM ADIMLARI: {description}"
        )
        
        # Vektör Dönüşümü
        embedding = embedding_model.encode([full_text]).tolist()
        
        # Meta Veriler
        metadata = {
            "source": f"[ŞİRKET HAFIZASI] {kod_temiz}",
            "page": 1,
            "kategori": "Saha Çözümü",
            "parent_text": full_text
        }
        
        collection.add(
            embeddings=embedding,
            documents=[full_text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        logger.info(f"✅ Yeni Saha Çözümü Vektör Uzayına Eklendi: {kod_temiz}")
        
        # BM25 Belleğini Güncelle
        initialize_search_engines()
        return True
    except Exception as e:
        logger.error(f"ChromaDB'ye ekleme hatası: {e}")
        return False


# ---------------------------------------------------------
# 2. YAPAY ZEKA YÖNLENDİRİCİSİ (AGENTIC ROUTER)
# ---------------------------------------------------------
@retry(
    wait=wait_random_exponential(multiplier=1, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception)
)
def agentic_router(current_query, chat_history):
    history_text = "Sohbet yeni başlıyor."
    if chat_history:
        history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history[-4:]])

    prompt = f"""
    Sen endüstriyel bir makine bakım asistanının NLP (Doğal Dil İşleme) yönlendiricisisin.

    KATEGORİ TANIMLARI:
    - Elektrik: Güç devreleri, elektromekanik elemanlar, sensörler, panolar.
    - Akümülatör: Basınçlı gaz sistemleri, akümülatör yedek parçaları.
    - Yağlama: Hidrolik devreler, filtreler.
    - Arayüz ve Kontrol: HMI, yazılım menüleri.
    - Yedek Parça: Komponent siparişi, stok numaraları.
    - Kullanım Kılavuzu: Genel mekanik, çalışma prensipleri, genel basınç/hacim özellikleri.
    - Saha Çözümü: Geçmiş arızalar, teknisyen müdahaleleri, onarım tecrübeleri.

    🛠️ NLP OPTİMİZASYON KURALLARI:
    1. HAFIZA: SON SORU'daki belirsiz ifadeleri (o, bu) GEÇMİŞ SOHBET'teki kodlarla değiştir.
    2. SADELEŞTİRME: Gereksiz soru kelimelerini sil. Sayfa numarası varsa ASLA SİLME (Örn: Sayfa 99 YV318).
    3. ÇOKLU KATEGORİ (YENİ KURAL): Eğer soru spesifik bir parça (Örn: Akümülatör) VE makinenin genel sistemini (Örn: Çalışma basıncı, toplam hacim) aynı anda ilgilendiriyorsa, virgülle ayırarak EN FAZLA 2 kategori seç. Aksi halde tek kategori seç.

    GEÇMİŞ SOHBET:
    {history_text}

    SON SORU: {current_query}

    ÇIKTI FORMATI:
    KATEGORİLER: [Virgülle ayrılmış kategori adları. Örn: Akümülatör, Kullanım Kılavuzu VEYA sadece Elektrik]
    SORU: [Sadeleştirilmiş Lazer Sorgu]
    """

    try:
        model = genai.GenerativeModel('models/gemini-flash-latest')
        response = model.generate_content(prompt)
        result = response.text.strip()

        cat_match = re.search(r'KATEGORİLER:\s*(.*)', result, re.IGNORECASE)
        q_match = re.search(r'SORU:\s*(.*)', result, re.IGNORECASE)

        # Virgülle ayrılmış kategorileri bir listeye (array) çeviriyoruz
        categories = [c.strip() for c in cat_match.group(1).split(',')] if cat_match else ["Kullanım Kılavuzu"]
        new_query = q_match.group(1).strip() if q_match else current_query

        logger.info(f"🧠 AI Yönlendirici -> Kategoriler: {categories} | Hedef Soru: [{new_query}]")
        return categories, new_query
    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "quota" in error_msg or "rate limit" in error_msg:
            if get_next_api_key(): 
                logger.info("🔄 Yeni anahtar ile deneniyor (Router)...")
                raise Exception(f"Rate limit hit, swapped to new key. Original error: {e}") 
        
        logger.error(f"Router Hatası: {e}")
        # Only fallback if all retries fail
        raise e

# ---------------------------------------------------------
# 3. HİBRİT ARAMA MOTORU (VEKTÖR + BM25)
# ---------------------------------------------------------
# ---------------------------------------------------------
# 3. HİBRİT ARAMA MOTORU (ROUTER + ALTIN SKOR + RRF)
# ---------------------------------------------------------
def hybrid_search(query_text, target_categories=None, n_results=8, apply_filter=True, source_filter=None, pages_filter=None):
    """
    Hem AI Router'ın kategori filtresini kullanır, hem Altın Skor ile duvarları yıkar,
    hem de RRF ile en adil sıralamayı yapar.
    """
    pool_size = 20
    rrf_k = 60
    doc_ranks = {}

    # --- A. VEKTÖR ARAMASI (Kategori Filtreli) ---
    where_clause = None
    search_categories = target_categories
    if apply_filter and target_categories and "Tümü" not in target_categories:
        search_categories = list(target_categories)
        if "Saha Çözümü" not in search_categories:
            search_categories.append("Saha Çözümü")
        where_clause = {"kategori": {"$in": search_categories}}
        logger.info(f"🎯 AI Filtresi Aktif: {search_categories}")

    try:
        if embedding_model is None:
            logger.warning("⚠️ Vektör modeli global olarak yüklenmemiş, tekrar yükleniyor...")
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            query_embedding = model.encode([query_text]).tolist()
        else:
            query_embedding = embedding_model.encode([query_text]).tolist()

        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection(name="bakim_dokumanlari")

        vector_results = collection.query(query_embeddings=query_embedding, n_results=pool_size, where=where_clause)

        if vector_results['documents']:
            for rank, (doc, meta) in enumerate(zip(vector_results['documents'][0], vector_results['metadatas'][0])):
                # Kaynak/sayfa filtresi (doc-chat)
                if source_filter:
                    meta_src = (meta.get('source') or '').split(' - ')[0].strip()
                    if source_filter not in meta_src and meta_src not in source_filter:
                        continue
                if pages_filter:
                    p = meta.get('page')
                    page_num = int(p) if p is not None and str(p).isdigit() else None
                    if page_num is None or page_num not in pages_filter:
                        continue
                unique_id = f"{meta.get('source')}_{meta.get('page')}"
                doc_ranks[unique_id] = {
                    "vector_rank": rank + 1,
                    "bm25_rank": 999,
                    "meta": meta,
                    "parent_text": meta.get('parent_text', doc)
                }
    except Exception as e:
        logger.error(f"Vektör hatası: {e}")

    # --- B. BM25 ARAMASI (Altın Skor İstisnalı) ---
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
                    if apply_filter and search_categories and "Tümü" not in search_categories:
                        if meta.get('kategori') not in search_categories:
                            is_in_category = False

                    # 🚀 ALTIN SKOR KURALI: Kategori dışındaysa ama skor 5.0'dan büyükse içeri al!
                    if not is_in_category:
                        if score > 5.0:
                            logger.info(
                                f"🚀 ALTIN SKOR! Kategori Duvarı Yıkıldı: {meta.get('kategori')} (Skor: {score:.2f})")
                        else:
                            continue  # Kategori dışı ve skoru da düşükse çöpe at

                    # Kaynak/sayfa filtresi (doc-chat)
                    if source_filter:
                        meta_src = (meta.get('source') or '').split(' - ')[0].strip()
                        if source_filter not in meta_src and meta_src not in source_filter:
                            continue
                    if pages_filter:
                        p = meta.get('page')
                        page_num = int(p) if p is not None and str(p).isdigit() else None
                        if page_num is None or page_num not in pages_filter:
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

    # --- C. RRF SKORLAMASI VE NİHAİ SIRALAMA ---
    final_results = []
    for unique_id, data in doc_ranks.items():
        vector_score = 1.0 / (rrf_k + data["vector_rank"])
        bm25_score = 1.0 / (rrf_k + data["bm25_rank"])

        # Parça kodlarında kelime eşleşmesi daha kritik olduğu için BM25 ağırlığını yüksek tutuyoruz
        total_rrf_score = (vector_score * 0.3) + (bm25_score * 0.7)

        final_results.append({
            "parent_text": data["parent_text"],
            "meta": data["meta"],
            "rrf_score": total_rrf_score,
            "type": f"RRF (Vektör:{data['vector_rank']} | BM25:{data['bm25_rank']})"
        })

    final_results = sorted(final_results, key=lambda x: x["rrf_score"], reverse=True)[:n_results]
    return final_results
# ---------------------------------------------------------
# 4. GÖRSEL ÇIKARIM VE ÜRETİM (MULTIMODAL GENERATION)
# ---------------------------------------------------------
def get_page_image(pdf_filename, page_number):
    """Bulunan sonucun orijinal PDF sayfasını yüksek çözünürlüklü resim olarak alır.
    Önce DATA_RAW, sonra backend/docs-public (rekürsif arama) dener."""
    if not pdf_filename or not str(pdf_filename).strip():
        return None
    # Sadece dosya adı kullan (path'teki - S.139 vb. kısımları temizle)
    base_name = str(pdf_filename).split(" - ")[0].strip()
    if not base_name.lower().endswith(".pdf"):
        base_name = base_name + ".pdf" if "." not in base_name else base_name
    page_num = max(1, int(page_number) if page_number else 1)
    candidates = [Path(DATA_RAW) / base_name]
    # backend/docs-public fallback (proje kökünden)
    docs_public = BASE_DIR.parent.parent / "backend" / "docs-public"
    if docs_public.exists():
        for f in docs_public.rglob("*.pdf"):
            if base_name.lower() in f.name.lower() or f.name.lower() in base_name.lower():
                candidates.append(f)
                break
    for pdf_path in candidates:
        try:
            doc = pdfium.PdfDocument(str(pdf_path))
            bitmap = doc[page_num - 1].render(scale=2)
            return bitmap.to_pil()
        except Exception:
            continue
    return None


@retry(
    wait=wait_random_exponential(multiplier=1, max=15),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception)
)
def generate_answer_with_vision(query, images, references, chat_history, mode="detailed"):
    """Gemini modelini kullanarak referans metinleri ve görselleri sentezler, JSON formatında cevap üretir."""
    history_context = ""
    if chat_history:
        history_context = "SOHBET GEÇMİŞİ:\n" + "\n".join(
            [f"- {msg['role']}: {msg['text'][:150]}..." for msg in chat_history[-2:]])

    prompt = [
        f"""
            Sen sahada arıza çözen, geniş teknik bilgiye sahip kıdemli bir Bakım Başmühendisisin. 
            GÖREVİN VE YANIT KURALLARI:
            
            Sana verilen REFERANSLAR iki bölümden oluşmaktadır:
            A) RESMİ DOKÜMANLAR (Öncelikli Başvuru Kaynağı)
            B) ŞİRKET HAFIZASI / SAHA ÇÖZÜMLERİ (Teknisyenlerin yaşanmış tecrübeleri)

            KURALLAR:
            1. DOKÜMANA SADAKAT: Orada yazmayan rakam veya ölçüleri KESİNLİKLE uydurma.
            2. FORMATLAMA - RESMİ KAYNAK: Cevabını verirken "Resmi Dokümanlara Göre:" başlığı altında resmi prosedürleri anlat.
            3. ⚠️ KRİTİK KURAL (HALÜSİNASYON ÖNLEME): Saha Tecrübesi metni ZORUNLU DEĞİLDİR. Eğer sana verilen REFERANSLAR metninde "Saha Çözümü" ibareleri YOKSA, ASLA VE ASLA "⚠️ Saha Tecrübemize Göre:" diye bir bölüm EKLEME! Yoktan saha tecrübesi uydurman yasaktır. 
            4. İSG: Kritik riskler varsa (yüksek basınç, gerilim vb.) EN BAŞA "⚠️ İSG UYARISI:" olarak ekle.
            5. BAĞLAM: 'SOHBET GEÇMİŞİ'ni dikkate al.
            6. SOHBET SINIRI: "Naber", "nasılsın", "kaç yaşındasın", "kimsin" gibi işle alakasız, kişisel veya günlük sohbet sorularına KESİNLİKLE cevap verme. Sadece "Ben bir endüstriyel bakım asistanıyım. Size yalnızca teknik konularda yardımcı olabilirim." şeklinde doğrudan ve kısa bir yanıt ver.

            🛑 ZORUNLU JSON ÇIKTISI KURALI: 
            Aşağıdaki JSON şablonunu KESİNLİKLE bozmadan, sadece geçerli bir JSON objesi döndür. Başka hiçbir açıklama, markdown ayracı veya text yazma. Sadece saf JSON veri!

            İstenen Mod: "{mode}" (Geçerli değerler: "short", "detailed", "work_order")

            Eğer mod "short" ise:
            {{
              "mode": "short",
              "error_code": "Soruda geçen bir arıza kodu varsa yaz (örn: E202), yoksa null",
              "short_answer": "Arızanın ne olduğuna dair 1-2 cümlelik çok kısa özet cevap",
              "detailed_answer": null,
              "work_order_suggestion": null
            }}

            Eğer mod "detailed" ise:
            {{
              "mode": "detailed",
              "error_code": "Soruda geçen arıza kodu",
              "short_answer": "Arızanın kısa özeti",
              "detailed_answer": "Yukarıda istenen tüm detayları (İSG Uyarıları, Resmi Doküman analizleri ve varsa Saha Tecrübesi) kapsayan uzun çözüm metni.",
              "work_order_suggestion": null
            }}

            Eğer mod "work_order" ise:
            {{
              "mode": "work_order",
              "error_code": "Soruda geçen arıza kodu",
              "short_answer": "Arızanın kısa özeti",
              "detailed_answer": "Tüm güvenlik ve çözüm detayları.",
              "work_order_suggestion": {{
                "title": "İş Emri Başlığı (Örn: E202 sensör temizliği ve kontrolü)",
                "machine_id": null,
                "machine_code": null,
                "estimated_duration_min": 45,
                "priority": "HIGH",
                "steps": ["Adım 1: Emniyetli duruş", "Adım 2: Sensör sökümü", "Adım 3: Temizlik"],
                "materials": []
              }}
            }}

            {history_context}

            =============================
            AKTÜEL SORU: {query}
            =============================
            
            REFERANSLAR: 
            {references}
            """
    ]
    prompt.extend(images)

    try:
        model = genai.GenerativeModel('models/gemini-flash-latest')
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Temizleme (Eğer JSON bloğu markdown code-block olarak gelmişse)
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        import json
        try:
            parsed_json = json.loads(text)
            return parsed_json
        except Exception as parse_error:
            logger.error(f"Yapay Zeka JSON Döndüremedi: {parse_error} - Raw: {text}")
            return {
                "mode": mode,
                "error_code": None,
                "short_answer": "Bir hata olustu. JSON parcalanamadi.",
                "detailed_answer": text,
                "work_order_suggestion": None
            }

    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "quota" in error_msg or "rate limit" in error_msg:
            if get_next_api_key(): 
                logger.info("🔄 Yeni anahtar ile deneniyor...")
                raise Exception(f"Rate limit hit, swapped to new key. Original error: {e}") 
        
        logger.error(f"API Hatası (Gemini): {e}")
        raise e 


# ---------------------------------------------------------
# ANA DÖNGÜ (CLI INTERFACE)
# ---------------------------------------------------------
def ask_ai_with_context(query, chat_history, mode="detailed", source=None, pages=None):
    """
    FastAPI için ana giriş noktası.
    Gelen soruyu işleyip API üzerinden iletilebilecek JSON/Dict formatında döndürür.
    Frontend'in gerektirdiği mode, short_answer, detailed_answer şablonuna uygundur.
    """
    if bm25 is None or embedding_model is None:
        initialize_search_engines()
        
    # 1. Router Devrede
    target_categories, search_query = agentic_router(query, chat_history)
    
    # 2. Hybrid Ara (source/pages: doc-chat belge kısıtı)
    source_filter = str(source).strip() if source else None
    pages_filter = [int(p) for p in pages if p is not None] if pages else None

    results = hybrid_search(search_query, target_categories, n_results=8, apply_filter=True,
                           source_filter=source_filter, pages_filter=pages_filter)
    if not results:
        results = hybrid_search(search_query, target_categories=None, n_results=8, apply_filter=False,
                               source_filter=source_filter, pages_filter=pages_filter)
        
    if not results:
        return {
            "mode": mode,
            "error_code": None,
            "short_answer": "Veritabanında eşleşen bilgi bulunamadı.",
            "detailed_answer": "❌ Tüm veritabanı tarandı ancak ilgili doküman veya Şirket Hafızası kaydı bulunamadı.",
            "work_order_suggestion": None,
            "attachments": []
        }
        
    # 3. Sonuçları Topla
    images_to_send = []
    reference_text = ""
    sources_info = []

    import base64
    from io import BytesIO

    for item in results:
        meta_src = item['meta'].get('source', 'Bilinmiyor')
        page = item['meta'].get('page', 0)
        category = item['meta'].get('kategori', 'Genel')
        
        att = {
            "source": meta_src,
            "page": page,
            "category": category,
            "type": item['type']
        }
        # PDF sayfa önizlemesi (snippet) - frontend'de gösterilecek
        if img := get_page_image(source, page):
            images_to_send.append(img)
            buf = BytesIO()
            img.save(buf, format='PNG')
            att["image_base64"] = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        sources_info.append(att)
        
        reference_text += f"\n--- KAYNAK: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
            
    # 4. JSON Formatında Cevabı Üret
    ai_json_response = generate_answer_with_vision(query, images_to_send, reference_text, chat_history, mode)
    
    # Kendi kaynaklarımızı 'attachments' başlığı altından sonuca iliştiriyoruz (Frontend isteği)
    ai_json_response["attachments"] = sources_info
    
    return ai_json_response

if __name__ == "__main__":
    print("Mühendis AI API modülü yüklendi. FastAPI sunucusunu 'python -m uvicorn app_api:app' komutuyla başlatın.")