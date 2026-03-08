# Bakım Destek Agent MVP

Fabrika makineleri için hata kodu tabanlı arıza takibi, alert ve çözüm adımları portalı.

## Özellikler

- **Gerçek Zamanlı Hata Tespiti:** Sensör verilerine göre otomatik alert oluşturma
- **Hata Kodu Dokümantasyonu:** Her hata kodu için adım adım onarım kılavuzu
- **Sorumlu Personel Atama:** Hata kodlarına göre otomatik rol atama (Elektrik Bakım, Hidrolik Bakım, vb.)
- **Severity Seviyeleri:** Critical, High, Medium, Info
- **Grafana Entegrasyonu:** Prometheus formatında metrik endpoint (`/api/metrics` veya `/metrics`)
- **ERP Tarzı Dashboard:** Makine durumu, açık alert özeti ve operasyon takibi
- **AI Chatbot:** Teknik dokümantasyonlardan bilgi almak için Gemini 1.5 Flash tabanlı soru-cevap sistemi
- **Kiosk/Tablet Uyumlu:** Büyük touch target'lar ve responsive tasarım

## Gereksinimler

- Node.js 18+
- MySQL 8+
- (İleride Electron ile kiosk sarmalama planlanmaktadır)

## Kurulum

### Backend

```bash
cd backend
cp .env.example .env
# .env içinde DATABASE_URL, PORT ve GEMINI_API_KEY'i düzenleyin
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

API: http://localhost:3001

**Not:** AI Chatbot için Gemini API key gereklidir. Google AI Studio'dan ücretsiz API key alabilirsiniz: https://aistudio.google.com/

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Uygulama: http://localhost:5173

## API Endpoints

- `GET /api/machines` - Makine listesi
- `GET /api/fault-codes` - Hata kodları
- `GET /api/alerts` - Alert listesi
- `GET /api/metrics` veya `GET /metrics` - Prometheus formatında metrikler (Grafana için)
- `POST /api/alerts` - Yeni alert oluştur (SCADA/ekipman entegrasyonu için)
- `GET /api/docs` - Yüklü doküman listesi
- `POST /api/docs/ask` - AI Chatbot'a soru sor

## Grafana Entegrasyonu

Prometheus datasource ile `/api/metrics` veya `/metrics` endpoint'ini kullanarak:
- Açık alert sayıları (severity bazlı)
- Makine bazlı açık alert sayıları
- Son 24 saatte çözülen alert sayısı

## Yapı

- `backend/` – Node.js + Express + Prisma API, mock sensör ve alert servisleri, AI Chatbot (Gemini RAG)
- `frontend/` – React (Vite) + Tailwind, ERP tarzı arayüz, AI Chatbot sayfası, kiosk/tablet uyumlu
- `docs/instructions/Pres Dokümanları/` – Teknik dokümantasyonlar (PDF, DOCX, TXT, MD)

## AI Chatbot Kullanımı

1. Dokümanlarınızı `docs/instructions/Pres Dokümanları/` klasörüne ekleyin
2. Backend'i başlatın (Gemini API key gerekli)
3. Frontend'te sol menüden "AI Chatbot" sayfasına gidin
4. Teknik sorularınızı sorun (örn: "yv90 nedir?", "400 hata kodu nedir, nasıl çözülür?")

Chatbot sadece yüklediğiniz dokümantasyonlardan bilgi verir. Dokümanlarda olmayan bilgiler için yetkili bakım sorumlusu ile görüşmenizi önerir.
