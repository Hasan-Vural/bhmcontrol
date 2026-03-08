import os
import re
import chromadb
import pypdfium2 as pdfium
import pytesseract
from PIL import Image
from sentence_transformers import SentenceTransformer
from src.config import VECTOR_DB_PATH, DATA_RAW
from src.logger import get_logger

logger = get_logger(__name__)

# =================================================================
# ⚠️ TESSERACT YOLU (WINDOWS İÇİN GEREKLİDİR)
# Eğer Windows kullanıyorsan ve Tesseract'ı C sürücüsüne kurduysan
# buradaki yolun doğru olduğundan emin ol. Linux/Mac kullanıyorsan bu satırı silebilirsin.
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


# =================================================================

def semantic_chunker(text, max_words=100, overlap_sentences=1):
    text = re.sub(r'\s+', ' ', text).strip()
    sentences = re.split(r'(?<=[.!?]) +', text)

    chunks = []
    current_chunk_sentences = []
    current_word_count = 0

    for sentence in sentences:
        sentence_word_count = len(sentence.split())
        if current_word_count + sentence_word_count <= max_words:
            current_chunk_sentences.append(sentence)
            current_word_count += sentence_word_count
        else:
            if current_chunk_sentences:
                chunks.append(" ".join(current_chunk_sentences))

            overlap_slice = current_chunk_sentences[-overlap_sentences:] if overlap_sentences > 0 else []
            current_chunk_sentences = overlap_slice + [sentence]
            current_word_count = sum(len(s.split()) for s in current_chunk_sentences)

    if current_chunk_sentences:
        chunks.append(" ".join(current_chunk_sentences))

    return chunks


def ingest_data():
    logger.info("🏗️ DATA INGESTION BAŞLIYOR (OCR + BATCHING + MULTILINGUAL)")
    logger.info("🧠 Çok dilli Embedding modeli yükleniyor...")
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

    client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
    try:
        client.delete_collection(name="bakim_dokumanlari")
        logger.info("🗑️ Eski veritabanı temizlendi.")
    except Exception:
        pass

    collection = client.create_collection(name="bakim_dokumanlari")

    pdf_files = [f for f in os.listdir(DATA_RAW) if f.endswith('.pdf')]
    if not pdf_files:
        logger.warning("⚠️ DATA_RAW klasöründe PDF bulunamadı!")
        return

    batch_size = 50  # OCR ağır bir işlem olduğu için batch size'ı biraz düşürdük
    batch_docs = []
    batch_metas = []
    batch_ids = []
    toplam_chunk = 0

    for pdf_file in pdf_files:
        pdf_path = os.path.join(DATA_RAW, pdf_file)
        logger.info(f"📄 İşleniyor ve Şemalar Okunuyor (OCR): {pdf_file}")

        pdf = pdfium.PdfDocument(pdf_path)

        for page_index in range(len(pdf)):
            page = pdf[page_index]

            # 1. DİJİTAL METNİ AL (PDF'in metin katmanı)
            textpage = page.get_textpage()
            raw_text = textpage.get_text_range()

            # 2. ŞEMALARI OKUMAK İÇİN OCR İŞLEMİ (GÖRSEL KATMANI)
            try:
                # Sayfayı yüksek çözünürlüklü resme çevir (scale=2 şemalar için yeterlidir)
                bitmap = page.render(scale=2)
                pil_image = bitmap.to_pil()

                # Hem Türkçe hem İngilizce dil paketi ile oku (YV90, SP1 gibi kodları yakalamak için eng şart)
                ocr_text = pytesseract.image_to_string(pil_image, lang='tur+eng')

            except Exception as e:
                logger.warning(f"OCR Hatası (Sayfa {page_index + 1}): {e}")
                ocr_text = ""

            # 3. İKİ DÜNYAYI BİRLEŞTİR
            # Hem dijital metni hem de şemaların içinden okunan kodları tek bir devasa metinde topluyoruz
            full_text = f"{raw_text}\n[ŞEMA VE GÖRSEL İÇERİKLERİ (OCR)]:\n{ocr_text}"

            if not full_text.strip():
                continue

            parent_text = re.sub(r'\s+', ' ', full_text).strip()
            chunks = semantic_chunker(full_text, max_words=100, overlap_sentences=1)

            for chunk_idx, chunk_text in enumerate(chunks):
                if len(chunk_text.strip()) < 10:
                    continue

                # Kategori Belirleme (Sözlük Eşleşmesi)
                dosya_adi = pdf_file.upper()
                kategori_map = {
                    "AKÜMÜLATÖR": "Akümülatör",
                    "ELEKTRİK": "Elektrik",
                    "ELEKTRİKLİ": "Elektrik",
                    "EKRAN": "Arayüz ve Kontrol",
                    "KLAVYE": "Arayüz ve Kontrol",
                    "YAĞLAMA": "Yağlama",
                    "YEDEK PARÇA": "Yedek Parça",
                    "TALİMATLAR": "Kullanım Kılavuzu"
                }
                
                kategori = next((v for k, v in kategori_map.items() if k in dosya_adi), "Genel Doküman")

                meta = {
                    "source": pdf_file,
                    "page": page_index + 1,
                    "chunk_id": chunk_idx,
                    "kategori": kategori,
                    "parent_text": parent_text
                }

                doc_id = f"{pdf_file}_p{page_index + 1}_c{chunk_idx}"

                batch_docs.append(chunk_text)
                batch_metas.append(meta)
                batch_ids.append(doc_id)
                toplam_chunk += 1

                if len(batch_docs) >= batch_size:
                    logger.info(f"⏳ {batch_size} parça vektörlenip gömülüyor...")
                    embeddings = model.encode(batch_docs).tolist()
                    collection.add(
                        ids=batch_ids,
                        embeddings=embeddings,
                        metadatas=batch_metas,
                        documents=batch_docs
                    )
                    batch_docs.clear()
                    batch_metas.clear()
                    batch_ids.clear()

    if len(batch_docs) > 0:
        logger.info(f"⏳ Kalan {len(batch_docs)} parça gömülüyor...")
        embeddings = model.encode(batch_docs).tolist()
        collection.add(
            ids=batch_ids,
            embeddings=embeddings,
            metadatas=batch_metas,
            documents=batch_docs
        )

    logger.info(f"✅ OCR İŞLEMİ TAMAM! Toplam {toplam_chunk} adet anlamlı parça gömüldü.")


if __name__ == "__main__":
    ingest_data()