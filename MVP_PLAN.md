# Bakım Destek Agent MVP – Uygulama Planı

## Mevcut Durum Özeti

Projede zaten şunlar var:

- **Backend:** `backend/src/index.js` – Express, Prisma, route’lar: machines, fault-codes, resolutions, alerts, sensor-mock.
- **Veritabanı:** `backend/prisma/schema.prisma` – Prisma modelleri: `Machine` (electrical/hydraulic), `FaultCode`, `FaultResolution`, `Alert`, `SensorReading`.
- **Frontend:** `frontend/src/App.jsx` – React (Vite) + Tailwind, sayfalar: Dashboard, Machines, FaultCodes, Resolutions, Alerts, AI Chatbot. Polling ile veri yenileme.

Eksik veya yapılacaklar: MySQL’e geçiş, severity’de INFO kullanımı, hatanın sorumlu personel/rol bilgisi, Grafana ile uyum, ana ekranda operasyon takibi ve basit/periyodik bakım fikri.

---

## 1. Veritabanı: SQLite → MySQL

- **Prisma:** `backend/prisma/schema.prisma` içinde `datasource db` bölümünde `provider = "mysql"` ve `url = env("DATABASE_URL")` (ör. `mysql://user:pass@localhost:3306/bakim_destek`).
- **Migration:** Mevcut schema aynı kalabilir; sadece provider değişecek. Yeni bir migration oluşturup (`prisma migrate dev`) MySQL’e uygulayın. SQLite’taki mevcut veri için gerekirse seed’i tekrar çalıştırın.
- **Not:** Proje şu an SQLite kullanıyor; MVP için MySQL’e geçmek tek net değişiklik.

---

## 2. Severity: LOW → INFO

- Endüstri tarafında “Info” yaygın; sizde de Critical, High, Medium, Info olsun.
- **Prisma:** `backend/prisma/schema.prisma` içinde `enum Severity` içinde `LOW` yerine `INFO` kullanın.
- **Etki:** Seed’de ve varsa sabit kodda `LOW` geçen yerleri `INFO` yapın; client’ta severity etiketleri “Info” olarak gösterilsin.

---

## 3. Sorumlu Personel / Rol (Hata Kodu Bazlı)

Hedef: Elektrik arızası → elektrik bakım personeli, hidrolik / periyodik bakım → ilgili operasyon personeli görsün; mesaj “sorumlu kişiye” gitsin.

- **Model:** Her hata kodu bir “sorumlu rol”e bağlansın. En basit MVP: `FaultCode` modeline `responsibleRole` alanı ekleyin (örn. `String?` veya enum: `electrical_maintenance`, `hydraulic_maintenance`, `periodic_maintenance`, `general`).
- **Veri:** Seed’de mevcut fault code’lara bu alanı ekleyin (E101 → electrical_maintenance, E102 → hydraulic_maintenance gibi).
- **API:** `GET /api/alerts` ve `GET /api/fault-codes` cevaplarında `faultCode.responsibleRole` dönsün (zaten include ile gelir).
- **UI:** Alert listesi ve detayda “Sorumlu: Elektrik Bakım” / “Hidrolik Bakım” gösterin. İleride kiosk/tablet için “Sadece benim rollerim” filtresi eklenebilir (MVP’de basit liste yeterli).

İsteğe bağlı (MVP sonrası): `Personnel` tablosu ve `Alert.assignedToPersonnelId` ile atama; şimdilik rol bazlı göstermek yeterli.

---

## 4. Gerçek Zamanlı Hata ve Grafana

- **Veri akışı:** Fabrikada makine verisi Grafana’ya gidiyor; sizde hata kodu tabanlı tespit ve dokümantasyon var. MVP’de iki uç:
  - **A)** Sistem dışarıdan hata kodu alacak: Gerçek ekipman/SCADA, hata kodu + makine bilgisi ile `POST /api/alerts` çağrısı yapacak (veya benzeri bir entegrasyon endpoint’i). Bu çağrıyla alert oluşur, UI ve Grafana tarafı aynı veriyi kullanır.
  - **B)** Şimdilik simülasyon: Mevcut `POST /api/alerts/test` veya sensör mock’u genişletip belirli eşik aşımlarında otomatik alert üretmek (ör. sıcaklık > X → E101 alert’i). Tercih: MVP’de (B) ile “gerçek zamanlı tespit” hissini verin; entegrasyon (A) dokümante edilip sonra bağlansın.
- **Grafana:** MVP için:
  - **Metrik endpoint:** Prometheus formatında metrik (örn. `GET /api/metrics` veya `/metrics`) – açık alert sayısı, severity’ye göre sayı, makine bazlı açık alert sayısı.
  - Alternatif: Grafana JSON datasource ile `GET /api/alerts?status=OPEN` gibi bir JSON endpoint’i kullanılabilir; Prometheus daha standarttır.

Özet: Backend’de (1) dış sistem için `POST /api/alerts` dokümante edilsin, (2) MVP’de eşik/simülasyon ile otomatik alert (opsiyonel), (3) Grafana için Prometheus tarzı `/api/metrics` (veya `/metrics`) eklenmesi.

---

## 5. Dokümantasyon (Hata Kodu → Onarım Adımları)

Zaten var: `FaultCode` → `FaultResolution` (adım sırası, başlık, açıklama, araçlar, tahmini süre).

- **Yapılacak:** UI’da bu bilginin her zaman görünür olması: Alert detay sayfasında (`frontend/src/pages/AlertDetail.jsx`) ilgili hata kodu ve onarım adımları net gösterilsin; hata kodu detay sayfasında (`frontend/src/pages/FaultCodeDetail.jsx`) tüm çözüm adımları listelensin.

---

## 6. Ana Ekran ve Operasyon Takibi (ERP Hissi)

- **Dashboard:** `frontend/src/pages/Dashboard.jsx` için:
  - Üstte özet: Açık alert sayısı (Critical / High / Medium / Info), toplam makine, “son 24 saatte çözülen” gibi tek sayı (opsiyonel).
  - Liste/panel: Açık alert’lerin kısa listesi (makine adı, hata kodu, severity, sorumlu rol, tarih); tıklanınca alert detaya gitsin.
  - Makine kartları: Mevcut yapı kalsın; her kartta “X açık uyarı” ve varsa severity rozeti gösterilsin.
- **Periyodik bakım:** Bazı hata kodlarını `responsibleRole = periodic_maintenance` veya `category = "periodic"` ile işaretleyip ana ekranda filtre/etiket ile ayırın.

---

## 7. Bildirim / Mesaj (Sorumlu Kişiye)

MVP’de “mesajın sorumluya gitmesi” = uygulama içi görünürlük:

- Alert oluşunca sorumlu rol belli (FaultCode.responsibleRole).
- Ana ekran ve Alerts sayfasında “Sorumlu: Elektrik Bakım” gibi gösterilir.
- E-posta/push/telegram MVP kapsamı dışı; sonra eklenebilir.

---

## 8. UI: Sade ve Güzel, Kiosk / Tablet Uyumu

- **Tasarım:** Tailwind ile tutarlı renk paleti (severity: Critical=kırmızı, High=turuncu, Medium=sarı, Info=gri/mavi).
- **Kiosk/tablet:** Buton ve liste satırları yeterince büyük (min touch target ~44px), font boyutları okunaklı. Layout responsive.
- **Electron / kiosk sarmalama:** MVP’de yapılmayacak; ileride Electron ile kiosk sarmalama planlanabilir.

---

## 9. Makine Öğrenmesi ve Dokümantasyon

MVP kapsamı: Sadece mevcut dokümantasyon (FaultResolution adımları) elle yönetilir; ML aşaması sonra.

---

## Mimari Özet (Veri Akışı)

```mermaid
flowchart LR
  subgraph external [Dis / Simülasyon]
    SCADA[SCADA / Ekipman]
    Mock[Mock Sensör / Eşik]
  end
  subgraph backend [Backend]
    API[Express API]
    Prisma[Prisma]
    MySQL[(MySQL)]
    Metrics["/api/metrics"]
  end
  subgraph frontend [Client]
    Dashboard[Dashboard]
    Alerts[Alerts]
    Detail[Alert / FaultCode Detail]
  end
  subgraph monitoring [İzleme]
    Grafana[Grafana]
  end
  SCADA -->|POST /api/alerts| API
  Mock -->|Eşik aşımı| API
  API --> Prisma
  Prisma --> MySQL
  API --> Metrics
  Metrics --> Grafana
  API -->|REST + polling| Dashboard
  API -->|REST + polling| Alerts
  Dashboard --> Detail
  Alerts --> Detail
```

---

## Yapılacaklar Listesi (Sıralı)

1. **MySQL geçişi:** Prisma schema’da provider = mysql, DATABASE_URL, yeni migration ve seed.
2. **Severity:** Enum’da LOW → INFO; seed ve client etiketleri.
3. **Sorumlu rol:** FaultCode’a responsibleRole; seed, UI’da “Sorumlu: …” gösterimi.
4. **Grafana metrik:** GET `/api/metrics` (Prometheus) – açık alert sayıları, severity ve makine bazlı.
5. **Alert oluşturma (simülasyon):** Mock sensör ile eşik kontrolü ve otomatik alert.
6. **Dokümantasyon vurgusu:** AlertDetail ve FaultCodeDetail’de onarım adımlarının net gösterimi.
7. **Dashboard güncellemesi:** Açık alert özeti + liste + sorumlu rol bilgisi.
8. **UI iyileştirmesi:** Kiosk/tablet için touch target ve tipografi.

