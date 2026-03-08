# Engenius Mühendis AI - Frontend API Dokümantasyonu (v1.1) 🚀

Merhaba! Bu doküman, Streamlit arayüzünden FastAPI tabanlı bağımsız bir Backend mimarisine geçiş sürecinde; Vue, React veya Vanilla JS ile geliştirilecek yeni kullanıcı arayüzü (Frontend) için bilmeniz gereken tüm REST API uçlarını (endpoints) ve JSON veri yapılarını içerir.

Backend sunucumuz `http://localhost:8002` portu üzerinde çalışmaktadır (Canlıya alınca domain eklenecektir).

Aşağıdaki CURL örneklerini Postman veya doğrudan JavaScript `fetch()` fonksiyonlarınızda kullanabilirsiniz.

---

## 🔗 Ana Endpointler

### 1. 🤖 Soru Sorma (Chat)
Yapay zekaya soru sormak için kullanılır. 
Frontend'in istediği formata göre 3 farklı modda çalışabilir:
*   `"mode": "short"` -> Çok hızlı çalışır. Sadece 1-2 cümlelik kısa cevap döner. `detailed_answer` ve `work_order_suggestion` alanları **null** döner. (Hızlı özet vb. için harika)
*   `"mode": "detailed"` -> Uzun açıklamalar içindir. `short_answer` ve `detailed_answer` doludur. `work_order_suggestion` alanı **null** döner.
*   `"mode": "work_order"` -> İş emri üretmek içindir. `short_answer`, `detailed_answer` ve adım adım operasyonları içeren `work_order_suggestion` objesi ful dolu döner.

*   **Endpoint URL:** `POST /api/chat`
*   **İstek Tipi (Request):** JSON

**Örnek JavaScript İsteği:**
```javascript
const response = await fetch("http://localhost:8002/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        query: "PH5000 1014 Profibus hatası nedir?",
        mode: "work_order", // veya "detailed" (Varsayılan: detailed)
        chat_history: [
            { role: "Mühendis", text: "Merhaba, bugün preslere bakacağız." },
            { role: "AI Asistan", text: "Merhaba, size nasıl yardımcı olabilirim?" }
        ]
    })
});
const data = await response.json();
console.log(data);
```

**Örnek JSON Çıktısı (mode = short):**
```json
{
  "mode": "short",
  "error_code": "1014",
  "short_answer": "1014 PROFIBUS HATASI, Profibus haberleşme hattında iletişimin kesildiğini ifade eder.",
  "detailed_answer": null,
  "work_order_suggestion": null,
  "attachments": [
    {
      "source": "PH750.85.002 Rev. 00",
      "page": 235,
      "category": "Kullanım Kılavuzu",
      "type": "RRF (Vektör:1 | BM25:2)"
    }
  ]
}
```

**Örnek JSON Çıktısı (mode = detailed):**
```json
{
  "mode": "detailed",
  "error_code": "1014",
  "short_answer": "1014 PROFIBUS HATASI, Profibus haberleşme hattında iletişimin kesildiğini ifade eder.",
  "detailed_answer": "⚠️ İSG UYARISI: Profibus hattı müdahalelerinde... (Uzun Metin)",
  "work_order_suggestion": null,
  "attachments": [
    {
      "source": "PH750.85.002 Rev. 00",
      "page": 235,
      "category": "Kullanım Kılavuzu",
      "type": "RRF (Vektör:1 | BM25:2)"
    }
  ]
}
```

**Örnek JSON Çıktısı (mode = work_order):**
```json
{
  "mode": "work_order",
  "error_code": "1014",
  "short_answer": "1014 PROFIBUS HATASI sebebiyle iletişim kopukluğu meydana gelmiştir.",
  "detailed_answer": "İlgili blokların konektörlerini kontrol ediniz...",
  "work_order_suggestion": {
    "title": "1014 Profibus haberleşme hatası için kontrol ve bağlantı incelemesi",
    "machine_id": null,
    "machine_code": null,
    "estimated_duration_min": 60,
    "priority": "HIGH",
    "steps": [
      "Makineyi emniyetli duruşa al ve enerji izolasyonunu uygula.",
      "Live List ekranından hatalı (kırmızı) blokları tespit et.",
      "Profibus konektörlerinin oturuşunu ve terminatör ayarını kontrol et."
    ],
    "materials": []
  },
  "attachments": [ ... ]
}
```


---

### 2. 📝 Yeni Saha Çözümü (İş Emri) Ekleme
Teknisyenlerin sahadaki tecrübelerini veritabanına eklemesini sağlar. Bu, doğrudan yapay zekaya gitmez, yönetici paneli (Bekleyenler tablosu) için SQLite veritabanında `pending` statüsünde bekler.

*   **Endpoint URL:** `POST /api/work-order/create`
*   **İstek Tipi (Request):** JSON

*Önemli: Backend sistemimiz `hata_kodu` parametresi gönderildiğinde, bu kodun gerçekten PDF dokümanlarında var olup olmadığını kontrol eden akıllı bir algoritmaya sahiptir. Eğer kod uydurmaysa `{"status": "error"}` döner.*

**Örnek Gönderilecek Payload:**
```json
{
  "hata_kodu": "1014",
  "title": "Profibus İletişim Hatası ve Sensör Kopması",
  "description": "Kablo klemens sırasından koptuğu için yeniden çakıldı.",
  "isg_checks": "[X] Pano enerjisi LOTO ile kesildi.",
  "ekipman": "Kontrol Panosu XA1",
  "author": "Ahmet Usta"
}
```

**Başarılı Dönüt:**
```json
{
  "status": "success",
  "message": "✅ '1014' doğrulandı. İş emri onaya gönderildi.",
  "id": 12
}
```

**Hatalı (Dokümanda Geçmeyen Kod) Dönüt:**
```json
{
  "status": "error",
  "message": "❌ 'ZX999' hiçbir PDF dokümanında bulunamadı.\nYalnızca dokümanlarda geçen kodlar için çözüm kaydedilebilir."
}
```

---

### 3. ⏳ Bekleyen Saha Çözümlerini Listeleme
Yönetici paneline (Admin Dashboard) ilk girildiğinde "Onay Bekleyen İş Emirlerini" tablo veya liste halinde çizmek için kullanılır.

*   **Endpoint URL:** `GET /api/work-order/pending`

**Örnek JSON Çıktısı (Array):**
```json
[
  {
    "id": 12,
    "hata_kodu": "1014",
    "title": "Profibus İletişim Hatası ve Sensör Kopması",
    "description": "Kablo klemens sırasından koptuğu için yeniden çakıldı.",
    "isg_checks": "[X] Pano enerjisi LOTO ile kesildi.",
    "ekipman": "Kontrol Panosu XA1",
    "author": "Ahmet Usta",
    "status": "pending",
    "created_at": "2026-03-04 10:59:11"
  }
]
```

---

### 4. ✅ Saha Çözümünü Onaylama ve AI'a Öğretme 🧠
Yönetici "Onayla" butonuna bastığında çalışır. Seçilen ID'ye sahip iş emrini SQLite veritabanında "Approved" olarak günceller ve **otomatik olarak ChromaDB Vektör Uzayına gömer.** Artık AI bu tecrübeden faydalanarak cevap verebilir!

*   **Endpoint URL:** `POST /api/work-order/approve/{id}`
*(Örnek: `http://localhost:8002/api/work-order/approve/12`)*

**Örnek JSON Çıktısı:**
```json
{
  "status": "success",
  "message": "İş emri #12 onaylandı ve Şirket Hafızasına işlendi!"
}
```

---

## 🛠️ Sistemi Nasıl Çalıştırırım?

Backend klasörünüzün kök dizinine (Örn: `Gemini_API_Clean` klasörü) terminal ile girip şu komutu çalıştırmanız yeterlidir:

```bash
python -m uvicorn app_api:app --reload --port 8002
```

Swagger UI (Etkileşimli API Dokümantasyonu) ve otomatik test alanı için tarayıcınızda şu adrese gidebilirsiniz:
👉 `http://localhost:8002/docs`
