# ☁️ Engenius Mühendis AI (RAG Sistemi)

Endüstriyel makine bakım dokümanları üzerinden akıllı, görsel destekli (multimodal) ve kategori bazlı cevap üreten gelişmiş bir Retrieval-Augmented Generation (RAG) asistanıdır.

Sistem iki temel versiyon barındırır:
1. **Cloud (Bulut) Sürümü:** Google Gemini Flash Modeli (`app_gemini.py` & `src/rag_engine.py`)
2. **Offline (Yerel) Sürümü:** Local Ollama / Llava Modeli (`app_llama.py` & `src/llama_engine.py`) - *Maksimum gizlilik gerektiren durumlar için.*

---

## 🏗️ 1. Mimari ve İşleyiş (Nasıl Çalışır?)

Sistem, bir kullanıcının sorusuna cevap verirken sırasıyla şu 3 ana adımdan geçer:

### Adım 1: Yapay Zeka Yönlendiricisi (Agentic Router)
Kullanıcının yazdığı soruyu doğrudan veritabanında aratmak yerine, önce bir LLM (Gemini veya Llama) üzerinden geçiririz. Bu botun amacı:
- **Kategori Belirleme:** Sorunun hangi sistemle ilgili olduğunu anlar (Örn: `Elektrik`, `Hidrolik`, `Akümülatör`, `Kullanım Kılavuzu`).
- **Sorgu Sadeleştirme:** Gereksiz kelimeleri ayıklayarak saf aranacak terimi çıkartır (Örn: "km1l nedir ?" -> "KM1L").
- **Hafıza Yönetimi:** "Onun basıncı nedir?" gibi sorularda, sohbet geçmişine bakarak "o" kelimesinin ne olduğunu (örn: Akümülatör) anlar.

### Adım 2: Hibrit Arama Motoru (Vektör + BM25 + RRF)
Bulunan kategoriye göre `ChromaDB` (Vektör Veritabanı) içinde arama yapılır.
*   **Vektör Araması (Semantic Search):** `paraphrase-multilingual-MiniLM-L12-v2` modeli ile anlamsal yakınlık aranır. Sadece *Agentic Router*'ın belirlediği kategorideki dokümanlarda arama yapar veya daraltır.
*   **BM25 (Kelime Avcısı):** Tam kelime eşleşmesi (Örn: Parça kodları, KM1L, YV90 vb.) için kullanılır. 
    *   *🚀 Altın Skor Kuralı:* Eğer aranan parça kodu o kadar spesifik ki BM25 skoru (5.0) sınırının üzerindeyse, kategori filtresini (duvarını) yıkarak o parçayı içeri alır!
*   **RRF (Reciprocal Rank Fusion):** Vektör sonuçları ile BM25 sonuçlarını en adil şekilde birleştirip puanlar. BM25 eşleşmeleri parça kodlarında daha kritik olduğu için hesaplamada %70 ağırlığa sahiptir. 

### Adım 3: Görsel Çıkarım ve Yanıt Üretimi (Multimodal Generation)
Bulunan doküman parçalarının sadece metinleri değil, **orijinal PDF sayfasının görüntüsü de** (`pypdfium2` ile render edilerek) alınır.
AI Asistana (Gemini veya Llava); kullanıcının sorusu, bulunan metinler, eşleşen PDF sayfalarının resimleri ve sohbet geçmişi beraber verilir. Bu sayede AI, şemayı "görerek" halüsinasyon (uydurma) yapmadan cevap üretir. (Anti-Flattening / Bilgi Düzleşmesini Önleme)

---

## 📂 2. Proje Dosya Yapısı

- `app_gemini.py` : Cloud/Gemini tabanlı Streamlit arayüz uygulamasının giriş noktası. (Web arayüzü)
- `app_llama.py` : Yerel (%100 offline) çalışan Llama/Llava tabanlı Streamlit arayüz uygulaması.
- `src/rag_engine.py` : Gemini motorunun arka plan (backend) fonksiyonlarını barındırır (Router, Search, Visual Gen).
- `src/llama_engine.py` : Llama motorunun arka plan fonksiyonlarını barındırır. (Görsel formatlaması ve timeout ayarları içerir)
- `src/data_ingest.py` : PDF'leri parçalara (chunk) bölüp ChromaDB vektör uzayına yerleştiren komut dosyasıdır.
- `test_gemini.py` / `test_llama.py` / `test_km1l.py`: Sistem performansını terminal üzerinden test etmek için hazır script'ler.

---

## 🚀 3. Kurulum ve Çalıştırma

### Gereksinimler
- Python 3.10+
- `.env` dosyasında geçerli bir Google Gemini API anahtarı. (`GOOGLE_API_KEY=AIzaSy...`)

### Çalıştırma (Web Arayüzü / Streamlit)

Proje dizininde (Masaüstündeki klasörde) terminalinizi/komut satırınızı açın ve versiyonunuza göre şu kodu çalıştırın:

**Bulut (Gemini) Sürümü için:**
```bash
streamlit run app_gemini.py
```

**Yerel (Offline Llama) Sürümü için:** *(Bilgisayarınızda Ollama yüklü ve çalışıyor olmalıdır)*
```bash
streamlit run app_llama.py
```

Streamlit sunucuyu ayaklandırdığında tarayıcınız otomatik olarak `http://localhost:8501` adresini açacak ve asistan kullanıma hazır olacaktır.

### Terminalden Hızlı Test
Arayüzü başlatmadan direkt arka planda hız testi yapmak için:
```bash
python test_gemini.py
# veya
python test_km1l.py
```

### Web API (HTTP) – Engenius entegrasyonu
RAG servisi, Engenius WebBackend’in `POST /ask` ile çağırdığı bir HTTP API olarak da çalışır. Detay için ana Engenius projesinde `docs/plans/engenius-calistirma-ozeti.md` içindeki **API modu** bölümüne bakın.

```bash
python -m uvicorn app_api:app --reload --host 0.0.0.0 --port 8000
```
- Swagger: `http://localhost:8000/docs`
- Sağlık: `GET http://localhost:8000/health`
- Soru: `POST http://localhost:8000/ask` body: `{"question": "...", "mode": "detailed"}` (mode: `short` | `detailed` | `work_order`)

---

## ⚠️ Kritik Uyarılar / Güvenlik
- **İSG Uyarısı (Prompt Kuralı):** Model, "Elektrik" veya "Basınçlı Sistemler" ile ilgili sorgularda kaza riskini azaltmak adına otomatik olarak İş Sağlığı ve Güvenliği (LOTO, voltaj vb.) uyarıları üretecek şekilde programlanmıştır.
- **API Yedeklemesi:** Gemini motoru, `.env` dosyasında birden fazla API anahtarını kabul eder (virgülle ayırarak). 429 Limit Aşımı yaşandığında otomatik olarak bir sonraki anahtara geçerek kesintisiz çalışmayı garanti eder.
