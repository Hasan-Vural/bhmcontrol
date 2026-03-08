# İlgili Sayfalar – Resim Önizleme Kök Neden Analizi

## Özet

"İlgili sayfalar" bölümünde PDF önizleme resimleri görünmüyor; sadece metin linkleri görünüyor. Eskiden kaynak belirtildiğinde çalışıyordu.

---

## Veri Akışı (End-to-End)

```
[RAG / FastAPI]                    [Backend Node]                    [Frontend]
     │                                    │                                │
     │  attachments: [{ source, page,     │                                │
     │    image_base64?, ... }]           │                                │
     │ ─────────────────────────────────>│  ai/query response              │
     │                                    │ ──────────────────────────────>│
     │                                    │                                │
     │                                    │  page-preview?name=X&page=N     │
     │                                    │ <──────────────────────────────│  (img src veya fallback)
     │                                    │  PNG image veya 404             │
     │                                    │ ──────────────────────────────>│
```

---

## Kök Neden Kategorileri

### 1. RAG tarafında `image_base64` üretilememesi

**Neden:** `get_page_image(source, page)` `None` döndürüyor.

| Durum | Açıklama |
|-------|----------|
| **Şirket Hafızası kaynakları** | `source` = `"Şirket Hafızası: #3 PH5000..."` gibi metin. Bu kaynaklar için fiziksel PDF yok; ChromaDB metin kaydı. `get_page_image` her zaman `None` döner. |
| **Dosya yolu uyuşmazlığı** | RAG `DATA_RAW` = `YZ/Gemini_API_Clean/data/raw` kullanıyor. PDF’ler burada yoksa veya farklı isimdeyse resim üretilemez. |
| **Source formatı** | `source` bazen `"ELEKTRİK PROJESİ.pdf - 5.30 (Elektrik)"` gibi geliyor. `get_page_image` `split(" - ")[0]` ile dosya adını alıyor; bu kısım doğru çalışıyor. |

**Sonuç:** `image_base64` yoksa frontend `api.docsPublicPagePreviewUrl(src, pageNum)` ile backend’e gidiyor.

---

### 2. Backend `page-preview` endpoint’i

**Neden:** `GET /api/docs-public/page-preview?name=...&page=...` 404 veya 500 dönüyor.

| Olası neden | Açıklama |
|-------------|----------|
| **`findBestFileMatch` eşleşemiyor** | `name` = `"Şirket Hafızası: #3 PH5000..."` gibi uzun metin. PDF dosya adıyla eşleşmiyor. |
| **`docs-public` boş/farklı** | PDF’ler `backend/docs-public/instructions/Pres Dokümanları/` altında. `listFilesRecursive` bu yapıyı destekliyor. |
| **RAG vs Backend PDF seti** | RAG `YZ/.../data/raw`, backend `backend/docs-public` kullanıyor. Farklı klasörlerde farklı PDF setleri varsa eşleşme olmayabilir. |

---

### 3. Frontend `img` yükleme hatası

**Neden:** `img` `onError` tetikleniyor, fallback (“Tarayıcıda aç”) gösteriliyor.

| Olası neden | Açıklama |
|-------------|----------|
| **404 / 500** | Backend önizleme üretemiyor veya dosya bulunamıyor. |
| **CORS** | `img src` cross-origin (örn. 5173 → 3001) genelde sorun çıkarmaz; yine de hata durumunda resim yüklenmez. |
| **Yanlış sayfa numarası** | `"5.30"` veya `"5.202"` gibi formatlardan yanlış sayfa çıkarılıyor; PDF’te o sayfa yoksa 404. |

---

## Öncelikli Kök Nedenler

1. **Şirket Hafızası kaynakları**  
   Bu kaynaklar için PDF yok. Hem RAG `image_base64` üretemez hem de backend `findBestFileMatch` ile dosya bulamaz. Bu tür kaynaklarda önizleme gösterilmemesi beklenen davranış.

2. **RAG vs Backend PDF konumları**  
   RAG `data/raw`, backend `docs-public` kullanıyor. Aynı PDF’ler her iki yerde de yoksa veya isimler farklıysa önizleme çalışmaz.

3. **Source formatı ve sayfa parsing’i**  
   `"ELEKTRİK PROJESİ.pdf - 5.30 (Elektrik)"` gibi formatlarda sayfa numarası yanlış parse edilebilir (örn. 30 veya 202). PDF’te o sayfa yoksa 404.

---

## Önerilen Aksiyonlar

### Kısa vadeli

1. **Backend loglama**  
   `page-preview` endpoint’inde `requested`, `found`, `pageNum` ve hata mesajlarını logla.
2. **Tarayıcı Network sekmesi**  
   `page-preview` isteğinin URL’sini, status kodunu ve response body’sini kontrol et.
3. **PDF konumlarını hizala**  
   RAG ingestion ve backend’in aynı PDF setini kullandığından emin ol; mümkünse tek kaynak (örn. `docs-public`) kullan.

### Orta vadeli

4. **Şirket Hafızası için fallback**  
   Bu kaynaklarda önizleme yerine “Saha çözümü – PDF önizlemesi yok” benzeri metin göster.
5. **Sayfa numarası parsing’i**  
   `"5.30"` = sayfa 5, `"5.202"` = sayfa 202 gibi kuralları netleştir; RAG metadata ile uyumlu hale getir.
6. **RAG `get_page_image` fallback**  
   `DATA_RAW`’da bulunamazsa `backend/docs-public` yolunu da dene (RAG tarafında zaten var, kontrol et).

---

## Hızlı Test

```bash
# Backend docs-public'te PDF var mı?
ls backend/docs-public/instructions/Pres\ Dokümanları/

# page-preview endpoint'ini manuel test
curl "http://localhost:3001/api/docs-public/page-preview?name=ELEKTRİK%20PROJESİ.pdf&page=1" -o test.png
```

---

## İlgili Dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/src/pages/Chat.jsx` | `attachments` render, `docsPublicPagePreviewUrl`, `onError` fallback |
| `backend/src/routes/docsPublic.js` | `page-preview`, `findBestFileMatch`, `listFilesRecursive` |
| `YZ/Gemini_API_Clean/src/rag_engine.py` | `get_page_image`, `sources_info`, `attachments` |
| `YZ/Gemini_API_Clean/src/config.py` | `DATA_RAW` yolu |
