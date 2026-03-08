RAG AI Servisi – Web Entegrasyon Planı

Mevcut Durum Özeti

YZ/Gemini_API_Clean (Arkadaşının kodu)





Arayüz: Sadece Streamlit (app_gemini.py); tarayıcıda streamlit run app_gemini.py.



RAG motoru: src/rag_engine.py içinde:





initialize_search_engines(): ChromaDB (bakim_dokumanlari), BM25, SentenceTransformer (paraphrase-multilingual-MiniLM-L12-v2).



agentic_router(): Kategori + sadeleştirilmiş sorgu üretir (Gemini Flash).



hybrid_search(): Vektör + BM25 + RRF, kategori filtresi.



generate_answer_with_vision(): Referans metin + görsellerle saf JSON üretir; alanlar: mode, error_code, short_answer, detailed_answer, work_order_suggestion.



ask_ai_with_context(query, chat_history, mode) zaten var ve “FastAPI için ana giriş noktası” olarak yorumlanmış; döndürdüğü dict’e attachments (kaynak listesi) ekleniyor.



Eksik: Proje kökünde FastAPI/HTTP API yok. app_api.py veya /ask endpoint’i tanımlı değil; requirements.txt içinde fastapi ve uvicorn yok.



Config: src/config.py – DATA_RAW, VECTOR_DB_PATH, DATA_PROCESSED path’leri; Chroma koleksiyonu data/vectordb, PDF’ler data/raw altında bekleniyor.

Engenius Web (Sizin taraf)





Backend: backend/src/index.js – Express, /api/ai routes/ai.js ile.



AI route: POST /api/ai/query body: question, mode (short | detailed | work_order), machineId, userId, autoCreateWorkOrder. Cevap: sessionId, workOrderId, ai (AiResponse).



AI sağlayıcı: backend/src/services/aiProvider.js – AI_PROVIDER=mock (varsayılan) veya AI_PROVIDER=fastapi. fastapiAsk() zaten FASTAPI_BASE_URL + /ask için POST atıyor ve dönen JSON’u AiResponse benzeri yapıya map ediyor (id, mode, error_code, short_answer, detailed_answer, work_order_suggestion, attachments). Base URL tanımlı değilse mock’a düşüyor.



CMMS: İş emri oluşturma şu an sadece WebBackend’de (Prisma WorkOrder, AiSession); autoCreateWorkOrder ve work_order_suggestion ile. Diyagramdaki “RAG -> CMMS” tek yönlü bilgi akışı, pratikte WebBackend’in RAG cevabını alıp iş emri açması ile karşılanıyor; RAG servisinin doğrudan CMMS’e yazması gerekmiyor.

Uyumluluk





Backend’in beklediği alanlar (error_code, short_answer, detailed_answer, work_order_suggestion, attachments) ile rag_engine’in döndürdüğü JSON uyumlu. Tek fark: Frontend tipinde attachments[] için { type, url, label? } tanımlı; Python tarafı { source, page, category, type } (RRF bilgisi) döndürüyor. WebBackend’de map veya tipi genişletmek yeterli.



Mimari (Diyagramla Uyumlu)

sequenceDiagram
  participant User as User_WebUI
  participant WebBackend as WebBackend
  participant RAG as RAG_AI_Service
  participant LLM as Gemini_or_Llama
  participant CMMS as CMMS_IsEmri

  User->>WebBackend: POST /api/ai/query (question, mode, ...)
  WebBackend->>RAG: HTTP POST /ask (question, mode, ...)
  RAG->>RAG: agentic_router + hybrid_search
  RAG->>LLM: LLM + RAG context + images
  LLM-->>RAG: JSON (short_answer, detailed_answer, ...)
  RAG-->>WebBackend: JSON cevap + attachments
  WebBackend->>WebBackend: AiSession + optional WorkOrder
  WebBackend-->>User: sessionId, workOrderId, ai
  Note over WebBackend,CMMS: autoCreateWorkOrder ise WorkOrder create



Gereksinimler ve Ortam Kurulumu

1. Python RAG Servisi (Gemini_API_Clean)







Gereksinim



Açıklama





Python



3.10+ (mevcut venv ile uyumlu)





Bağımlılık



requirements.txt’e fastapi, uvicorn[standard] eklenmeli





Ortam



.env içinde GOOGLE_API_KEY (mevcut); isteğe bağlı RAG_HOST, RAG_PORT, CORS_ORIGINS





Veri



data/raw altında referans PDF’ler; data/vectordb içinde Chroma koleksiyonu bakim_dokumanlari dolu olmalı (embedding pipeline zaten projede var, ayrı doküman yükleme senaryosu değişmiyor)

2. Engenius Backend







Gereksinim



Açıklama





Ortam



.env içinde AI_PROVIDER=fastapi, FASTAPI_BASE_URL=http://localhost:8000 (veya RAG servisinin gerçek URL’i); isteğe bağlı FASTAPI_API_KEY





Bağımlılık



Ek paket gerekmez; mevcut fetch ile HTTP isteği yapılıyor

3. Ağ ve Çalıştırma Sırası





RAG servisi (FastAPI) önce ayağa kalkmalı (örn. port 8000).



WebBackend (Express) RAG’a erişebilmeli (aynı makinede localhost veya ağdan URL).



CORS: RAG tarafında WebBackend/frontend origin’ine izin verilmeli.



Yapılacaklar (Detaylı)

Faz 1: RAG Servisine HTTP API Eklemek (YZ/Gemini_API_Clean)





Bağımlılık





YZ/Gemini_API_Clean/requirements.txt dosyasına fastapi ve uvicorn[standard] satırlarını ekleyin.



FastAPI uygulaması (app_api.py)





Proje kökünde yeni dosya: app_api.py.



FastAPI app oluştur; CORS middleware ile frontend/WebBackend origin’lerine izin verin (örn. http://localhost:3000, http://localhost:5173, http://localhost:3001 veya .env’den CORS_ORIGINS).



Tek endpoint: POST /ask





Body (JSON): question (string, zorunlu), mode (string, optional, default "detailed"; geçerli: short, detailed, work_order), machineId, machineCode, userId (optional; ileride chat_history için kullanılabilir).



İçeride: ask_ai_with_context(query, chat_history=[], mode) çağrısı. İlk aşamada chat_history boş liste; ileride WebBackend’den son N mesaj gönderilirse buraya bağlanır.



Yanıt: Rag_engine’in döndürdüğü dict’i doğrudan JSON olarak dön (id eklenebilir; backend’de zaten id: data.id || randomUUID() kullanılıyor).



Hata durumunda: 500 ve anlamlı mesaj (örn. “RAG motoru hatası”) ve mümkünse log.



İsteğe bağlı: GET /health (200 + ok) ile sağlık kontrolü.



Çalıştırma





uvicorn app_api:app --host 0.0.0.0 --port 8000 (veya RAG_PORT). YZ/docs/engenius-calistirma-ozeti.md dokümanına “API modu” bölümü eklenebilir: python -m uvicorn app_api:app --reload --port 8000.



.env örneği





Proje kökünde .env.example veya dokümanda: GOOGLE_API_KEY=..., RAG_PORT=8000, CORS_ORIGINS=http://localhost:3001,http://localhost:5173.

Faz 2: WebBackend’i RAG’a Bağlamak





Ortam değişkenleri





Engenius backend/.env: AI_PROVIDER=fastapi, FASTAPI_BASE_URL=http://localhost:8000. RAG farklı makinedeyse tam URL (örn. http://192.168.1.10:8000). İsteğe bağlı: FASTAPI_API_KEY (RAG tarafında Bearer kontrolü ileride eklenebilir).



aiProvider eşlemesi





backend/src/services/aiProvider.js içinde fastapiAsk() zaten error_code, short_answer, detailed_answer, work_order_suggestion, attachments map ediyor. Python’daki attachments formatı { source, page, category, type }; frontend tipi url bekliyor. İki seçenek:





A) Backend’de attachments’ı olduğu gibi geçir; frontend’de “kaynak: X, sayfa Y” metni göster (URL zorunlu değil).



B) Backend’de Python attachment’ı { type: 'pdf', label: ${source} S.${page} } gibi bir forma map et (url boş veya placeholder).

 Plan: Önce A ile ilerleyin; UI’da “Kaynaklar” listesi metin olarak gösterilir. İleride PDF/sayfa linki üretilirse B’ye geçilebilir.



Hata ve zaman aşımı





fastapiAsk() içinde fetch için AbortController/timeout (örn. 60–90 saniye) ekleyin; RAG yanıt vermezse kullanıcıya anlamlı mesaj ve gerekirse mock’a düşme davranışı korunur.

Faz 3: CMMS / İş Emri Akışı (Diyagramla Uyum)





Diyagramda “RAG_AI_Service -> CMMS” tek yönlü: RAG’ın ürettiği bilginin CMMS’e gitmesi.



Mevcut tasarımda bu akış WebBackend üzerinden gerçekleşiyor: /api/ai/query cevabında work_order_suggestion gelir; autoCreateWorkOrder === true ise WebBackend Prisma ile WorkOrder oluşturuyor. RAG servisinin doğrudan veritabanına veya CMMS API’ye yazması gerekmez; tek kaynak WebBackend kalır. Ek geliştirme: İsteğe bağlı olarak RAG’dan dönen work_order_suggestion.steps / materials bilgisini iş emri detayına yazmak (zaten description’a metin yazılıyor).

Faz 4: Test ve Doğrulama





RAG tek başına





curl -X POST http://localhost:8000/ask -H "Content-Type: application/json" -d "{\"question\":\"Yv90 nedir?\",\"mode\":\"detailed\"}" ile JSON cevap (short_answer, detailed_answer, attachments) gelmeli.



WebBackend + RAG





Backend’i AI_PROVIDER=fastapi, FASTAPI_BASE_URL=http://localhost:8000 ile başlatın; frontend veya Postman ile POST /api/ai/query (question, mode) atın; cevabın RAG’dan geldiğini (session + ai içeriği) doğrulayın.



İş emri





mode: work_order, autoCreateWorkOrder: true ile istek atıp ilgili makineyle birlikte WorkOrder kaydının oluştuğunu kontrol edin.

Faz 5: Dokümantasyon ve Çalıştırma Sırası





YZ/docs/engenius-calistirma-ozeti.md: “API modu” başlığı altında venv, pip install -r requirements.txt, uvicorn app_api:app --port 8000 ve POST /ask body/response örneği.



Engenius README veya backend .env.example: RAG entegrasyonu için AI_PROVIDER, FASTAPI_BASE_URL açıklaması.



Çalıştırma sırası: 1) Chroma + data/raw hazır; 2) cd YZ/Gemini_API_Clean → venv → uvicorn app_api:app --port 8000; 3) cd backend → npm run dev; 4) Frontend’den AI konsolu kullanımı.



Özet Tablo: Kimde Ne Var / Ne Eksik







Bileşen



Var



Eksik / Yapılacak





RAG motoru (router, search, vision, JSON)



Evet (rag_engine)



-





ask_ai_with_context + JSON çıktı



Evet



-





FastAPI POST /ask



Hayır



app_api.py + uvicorn





requirements (fastapi, uvicorn)



Hayır



requirements.txt güncelleme





WebBackend /api/ai/query



Evet



-





aiProvider fastapiAsk



Evet



Timeout; attachment formatı opsiyonel map





CMMS (WorkOrder)



WebBackend’de



RAG’dan doğrudan yazma yok, gerek yok





Chat history RAG’a gönderme



Hayır



İleride body’ye chat_history eklenebilir

Bu plan, paylaştığınız mimari diyagramı (User/WebUI -> WebBackend -> RAG_AI_Service -> JSON cevap; WebBackend <-> CMMS) kodla eşleştirir ve eksik tek parça olan RAG HTTP API (POST /ask) ile ortam/gereksinimlerin netleştirilmesini kapsar.