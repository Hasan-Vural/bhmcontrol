# Dokümantasyon Soru-Cevap Sistemi

Bu sistem, teknik dokümantasyonları okuyup bakım personelinin sorularını cevaplayan bir RAG (Retrieval-Augmented Generation) sistemidir.

## Kurulum

1. **Gerekli paketleri yükleyin:**
```bash
cd backend
npm install
```

2. **Gemini API Key'i ekleyin:**
   - `.env` dosyası oluşturun (`.env.example`'dan kopyalayın)
   - `GEMINI_API_KEY="your-api-key-here"` ekleyin
   - Google AI Studio'dan ücretsiz API key alabilirsiniz: https://aistudio.google.com/

3. **Dokümanları ekleyin:**
   - Dokümanlarınızı `docs/instructions/Pres Dokümanları/` klasörüne kopyalayın
   - Alternatif olarak `backend/docs/` klasörüne de ekleyebilirsiniz
   - Desteklenen formatlar: PDF, DOCX, DOC, TXT, MD

## API Endpoints

### 1. Doküman Listesi
```bash
GET /api/docs
```
Yüklenmiş dokümanların listesini döndürür.

**Örnek:**
```bash
curl http://localhost:3001/api/docs
```

**Yanıt:**
```json
{
  "count": 3,
  "files": ["makine1.pdf", "hata_kodlari.docx", "bakim_klavuzu.txt"]
}
```

### 2. Soru Sor
```bash
POST /api/docs/ask
Content-Type: application/json

{
  "question": "yv90 nedir?"
}
```

**Örnek:**
```bash
curl -X POST http://localhost:3001/api/docs/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "yv90 nedir?"}'
```

**Yanıt:**
```json
{
  "answer": "YV90, makine kontrol sisteminde kullanılan bir sensör modelidir...",
  "sources": ["makine1.pdf", "hata_kodlari.docx"],
  "confidence": "high",
  "documentCount": 3
}
```

### 3. Doküman Yükle (API üzerinden)
```bash
POST /api/docs/upload
Content-Type: multipart/form-data

document: [dosya]
```

**Örnek:**
```bash
curl -X POST http://localhost:3001/api/docs/upload \
  -F "document=@/path/to/your/document.pdf"
```

### 4. Doküman Sil
```bash
DELETE /api/docs/:filename
```

**Örnek:**
```bash
curl -X DELETE http://localhost:3001/api/docs/makine1.pdf
```

## Kullanım Senaryoları

### Senaryo 1: Dokümanları Klasöre Kopyalama
1. Dokümanlarınızı `docs/instructions/Pres Dokümanları/` klasörüne kopyalayın
2. Backend'i başlatın: `cd backend && npm run dev`
3. Frontend'te AI Chatbot sayfasına gidin: `http://localhost:5173/chat`
4. Veya API üzerinden soru sorun: `POST /api/docs/ask`

### Senaryo 2: API Üzerinden Yükleme
1. `POST /api/docs/upload` ile doküman yükleyin
2. Soru sorun: `POST /api/docs/ask`

## Örnek Sorular

- "yv90 nedir?"
- "400 hata kodu nedir, nasıl çözülür?"
- "Makine sıcaklığı nedir?"
- "Test aşamalarını birbir anlatır mısın?"

## Sistem Özellikleri

- ✅ **Sadece dokümantasyondan cevap verir**: Eğer bilgi dokümanlarda yoksa, "yetkiliyle görüş" mesajı döner
- ✅ **Çoklu format desteği**: PDF, Word, TXT, Markdown
- ✅ **Kaynak gösterimi**: Hangi dokümandan bilgi alındığını gösterir
- ✅ **Güven seviyesi**: Cevabın güvenilirliğini belirtir

## Notlar

- Dokümanlar öncelikle `docs/instructions/Pres Dokümanları/` klasöründen okunur
- Yoksa `backend/docs/` klasörü kullanılır
- Maksimum dosya boyutu: 50MB
- Gemini 1.5 Flash modeli kullanılır (ücretsiz tier)
- Sistem dokümanlarda olmayan bilgiler için genel cevap vermez, yetkili bakım sorumlusu ile görüşmenizi önerir

## Sorun Giderme

**"GEMINI_API_KEY environment variable is required" hatası:**
- `.env` dosyasında `GEMINI_API_KEY` tanımlı olduğundan emin olun

**"Henüz hiç dokümantasyon yüklenmemiş" mesajı:**
- `docs/instructions/Pres Dokümanları/` veya `backend/docs/` klasörüne doküman eklediğinizden emin olun
- Dosya formatının desteklendiğinden emin olun (PDF, DOCX, DOC, TXT, MD)

**Dosya okuma hatası:**
- Dosyanın bozuk olmadığından emin olun
- Dosya formatının doğru olduğundan emin olun
