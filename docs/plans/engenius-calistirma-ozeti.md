# Engenius Mühendis AI – Konuşma Özeti

Bu belge, Engenius Mühendis AI (RAG Sistemi) hakkındaki konuşmanın özetidir.

---

## Proje Nedir?

**Engenius Mühendis AI**, endüstriyel makine bakım dokümanları üzerinden çalışan, görsel destekli (multimodal) ve kategori bazlı cevap üreten bir **Retrieval-Augmented Generation (RAG)** asistanıdır.

- **Bulut sürümü:** Google Gemini (app_gemini.py)
- **Yerel sürümü:** Ollama / Llava (app_llama.py), tamamen offline

Sistem: Agentic Router → Hibrit Arama (Vektör + BM25 + RRF) → Görsel çıkarım ve yanıt üretimi.

---

## Nasıl Çalıştırılır?

### 1. Proje klasörüne geç
Terminalde projenin kök dizinine gidin (app_gemini.py, src, requirements.txt burada olmalı).

### 2. Sanal ortam (venv)
- Yoksa: `python -m venv venv`
- Aktifleştirme (Windows PowerShell): `.\venv\Scripts\Activate.ps1`

### 3. Bağımlılıklar
```bash
pip install -r requirements.txt
```

### 4. .env ve API anahtarı
Proje kökünde `.env` dosyası ve içinde:
```env
GOOGLE_API_KEY=AIzaSy...
```
Google AI Studio’dan anahtar alınabilir.

### 5. Uygulamayı başlatma
- **Gemini (bulut):** `streamlit run app_gemini.py`
- **Llama (yerel):** Ollama kurulu olmalı; `streamlit run app_llama.py`

Tarayıcıda `http://localhost:8501` açılır.

### 6. Hızlı test (arayüz olmadan)
```bash
python test_gemini.py
# veya
python test_km1l.py
```

---

## Cursor’dan Çalıştırma

Uygulama **Cursor IDE içinden** çalıştırılabilir:

1. **File → Open Folder** ile Engenius proje klasörünü açın.
2. **Ctrl + `** ile entegre terminali açın.
3. Aynı komutları (venv aktivasyonu, `pip install`, `streamlit run app_gemini.py`) bu terminalde çalıştırın.

Arayüz tarayıcıda açılır; başlatma Cursor terminalinden yapılır.

---

## Özet Tablo

| Adım | İşlem |
|------|--------|
| 1 | Proje klasörüne `cd` |
| 2 | `.\venv\Scripts\Activate.ps1` (veya önce `python -m venv venv`) |
| 3 | `pip install -r requirements.txt` |
| 4 | `.env` içinde `GOOGLE_API_KEY` kontrolü |
| 5 | `streamlit run app_gemini.py` |
| 6 | Tarayıcıda http://localhost:8501 |

PowerShell script çalıştırma hatası alınırsa:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## API modu (Web entegrasyonu)

RAG servisi, Engenius WebBackend’in `POST /ask` ile çağırdığı bir HTTP API olarak da çalıştırılabilir.

### Ön koşullar
- Aynı adımlar (venv, `pip install -r requirements.txt`, `.env` içinde `GOOGLE_API_KEY`).
- İsteğe bağlı: `.env` içinde `RAG_PORT=8000`, `CORS_ORIGINS=http://localhost:3001,http://localhost:5173`.

### Çalıştırma
```bash
# Gemini_API_Clean proje kökünde
python -m uvicorn app_api:app --reload --host 0.0.0.0 --port 8000
```
Tarayıcıda API dokümantasyonu: `http://localhost:8000/docs`.

### POST /ask örneği
**İstek (JSON):**
```json
{
  "question": "Yv90 nedir?",
  "mode": "detailed"
}
```
**Geçerli mode değerleri:** `short`, `detailed`, `work_order`.

**Yanıt (JSON):** `mode`, `error_code`, `short_answer`, `detailed_answer`, `work_order_suggestion`, `attachments` (kaynak listesi: source, page, category, type).

### Sağlık kontrolü
```bash
curl http://localhost:8000/health
```
Beklenen: `{"status":"ok","service":"rag-ai"}`.

---

## Web entegrasyonu – çalıştırma sırası

1. **Chroma + veri hazır:** `data/raw` altında referans PDF’ler; `data/vectordb` içinde `bakim_dokumanlari` koleksiyonu dolu olmalı.
2. **RAG API:** `cd YZ/Gemini_API_Clean` → venv aktif → `python -m uvicorn app_api:app --port 8000`.
3. **Engenius Backend:** `cd backend` → `.env` içinde `AI_PROVIDER=fastapi`, `FASTAPI_BASE_URL=http://localhost:8000` → `npm run dev`.
4. **Frontend:** Uygulamayı açıp AI konsolundan soru sorun; cevaplar RAG servisinden gelir.
