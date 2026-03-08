# AI Chatbot – Senaryo Testleri (RAG Entegrasyonu)

Bu dosya, AI Chatbot ekranı üzerinden (AI Chatbot sayfası + /api/ai/query + Python RAG `/ask`) kurgulanan temel kullanım senaryolarını ve gözlemlenen / beklenen davranışları özetler.

> Not: Aşağıdaki `Gerçek Çıktı Özeti` bölümleri, FastAPI RAG servisine (`http://127.0.0.1:8000/ask`) yapılan gerçek çağrılardan kısaltılarak alınmıştır. Diğer senaryolarda, aynı davranış akışı beklenen tasarım mantığına göre özetlenmiştir.

---

## 1. Hata kodu soran bakım elemanı (tanımsız kod) – **Gerçek test**

- **Soru (mode = `work_order`):**  
  `E202 hatası veriyor, makine durdu. Ne yapmalıyım?`
- **Amaç:** Dokümanlarda olmayan bir hata kodu ile karşılaşan teknisyen.
- **RAG JSON cevabı (özet):**
  - `mode`: `work_order`
  - `error_code`: `E202`
  - `short_answer`: E202, resmi teknik dokümanlarda ve şirket hafızasında tanımlı değil.
  - `detailed_answer` (özet):
    - İSG uyarısı ile başlıyor (LOTO + elektrik panosu güvenliği).
    - Dokümanlarda mevcut hata kodu aralıklarını listeliyor (0001–0012, 0119–0125, 1003–1008, 2168–2173 vb.).
    - E202’nin bu tablolarda bulunmadığını, bu nedenle SACMI müşteri desteği ve PLC haberleşme kontrollerinin devreye alınmasını öneriyor.
  - `work_order_suggestion`:
    - **Başlık:** `Tanımlanamayan Arıza Kodu (E202) Teşhis ve Sistem Kontrolü`
    - **Önem:** `HIGH`
    - **Adımlar (özet):**
      1. Panelde görülen hata kodu ve metnini eksiksiz not et.
      2. PLC iletişim / haberleşme simgelerini kontrol et.
      3. Profibus kartı ve SF/BF LED durumlarını gözlemle.
      4. Benzer hata kodlarıyla (ör. 2172, 0002) karışıklık olup olmadığını kontrol et.
      5. Hala tanımlanamıyorsa SACMI destek hattı ile iletişime geç.
  - `attachments`:
    - `EKRAN VE KLAVYE KULLANIM TALİMATI.pdf` (Sayfa 160, 166, 163, 168, 204)
    - `TALİMATLAR KLAVUZU.pdf` (Sayfa 66)
    - `Şirket İçi Kurumsal Hafıza` (Saha Çözümü)

**Chatbot ekranı açısından beklenen davranış:**
- Kullanıcı mod çubuğundan **“İş Emri”**’ni seçer.
- Mesaj balonunda:
  - Kısa özet,
  - Altında açılır “Detaylı cevabı göster”,
  - Hata kodu rozeti: `Hata Kodu: E202`,
  - “İlgili sayfalar” bölümünde yukarıdaki PDF + sayfa rozetleri.
- Aynı istek, Bakım AI Konsolu’ndan da yapılırsa; `autoCreateWorkOrder = true` ise iş emri kaydı açılır.

---

## 2. YV90 valfi hakkında soru soran bakım elemanı – **Gerçek test**

- **Soru (mode = `short`):**  
  `YV90 nedir?`
- **Amaç:** Saha hafızasına kaydedilmiş bir arıza senaryosunun geri çağrılması.
- **RAG JSON cevabı (özet):**
  - `mode`: `short`
  - `error_code`: `YV90`
  - `short_answer` (parafraz):
    - İSG uyarısı (LOTO ve basınç tahliyesi).
    - Resmi dokümana göre PH5000 için standart yağ sıcaklığı 40°C civarı.
    - Saha tecrübesine göre: YV90 valfi takılı kaldığında pres aşırı ısınma / 400°C uyarısı üretebiliyor; bu durumda valf sökülüp X contası yenileniyor ve sistem 55 bar civarına yeniden kalibre ediliyor.
  - `attachments`:
    - Birden fazla “Şirket Hafızası: PH5000 YV90 valf arızası ve ısınma” kaydı.
    - `ELEKTRİK PROJESİ.pdf` ilgili sayfalar (21, 84, 143).

**Chatbot ekranı açısından beklenen davranış:**
- Kullanıcı mod çubuğundan **“Kısa Özet”** seçer.
- Mesaj balonunda:
  - Kısa açıklama + İSG bloğu.
  - Hata kodu rozeti: `Hata Kodu: YV90`.
  - “İlgili sayfalar” altında Saha Hafızası notları ve ilgili elektrik proje sayfaları rozet olarak görünür.
  - Bakım AI Konsolu’nda aynı soru, “Detaylı Cevap” modunda sorulduğunda adım adım çözüm + iş emri taslağı çıkar.

---

## 3. Makine sıcaklığı fazla gelen bakım elemanı (tasarım senaryosu)

- **Soru (mode = `detailed`):**  
  `PH5000 presinde yağ sıcaklığı 60°C civarına çıkıyor, ne yapmalıyım?`
- **Beklenen davranış:**
  - İSG uyarısı (sıcak yağ, 230 bar vb.).
  - RAG, viskozite ve sıcaklık kartlarını (yağlama şeması, 200.02.A01 vb.) referans alır.
  - Detaylı cevapta:
    - Normal çalışma aralığı (≈ 40°C),
    - Kritik eşikler: 2°C altında motor kilidi, 5°C altında ısıtma devresi, 41/39°C soğutma vanası, 60°C üstü termostat blokajı,
    - Operasyonel öneriler: soğutma devresi, ısı değiştirici su debisi, filtre kontrolü vb.
  - Attachments kısmında:
    - Yağlama kartı sayfaları,
    - Sıcaklık–viskozite tablosu sayfaları.

---

## 4. Genel bilgi isteyen teknisyen (tasarım senaryosu)

- **Soru (mode = `short`):**  
  `PH5000LB presi için önerilen hidrolik yağ ve viskozite değerleri nelerdir?`
- **Beklenen davranış:**
  - Kısa cevapta:
    - ISO VG 46 (HLP 46) tipi, çinko içermeyen yağ,
    - 40°C’de ~41.4–50.6 mm²/s viskozite aralığı,
    - Viskozite endeksi > 110.
  - Detaylı cevapta (isteğe bağlı):
    - 0°C ve 100°C için uç değerler,
    - Soğutma/ısıtma eşikleri ve yağ temizliği için ISO 4406 sınırları.
  - Attachments: yağlama kartı ve PH5000 hidrolik şeması sayfaları.

---

## 5. Alakasız / sohbet amaçlı soru soran teknisyen (tasarım senaryosu)

- **Soru (mode = `short`):**  
  `Dün akşamki futbol maçını kim kazandı?`
- **Beklenen davranış (prompt kuralına göre):**
  - Model, teknik olmayan / saha dışı sorulara **kısa ve net** şu minvalde cevap vermeli:
    - “Ben endüstriyel bakım asistanıyım, sadece teknik konularda yardımcı olabilirim.”
  - Ek teknik içerik, kaynak veya iş emri üretmez.

---

## 6. Çıktıyı geri yazıp sadeleştirme isteyen teknisyen (tasarım senaryosu)

- **Akış:**
  1. Teknisyen önce detaylı bir cevap alır (ör. `mode = detailed`).
  2. Ardından:
     - **Soru:** `Yukarıdaki cevabı saha operatörüne anlatmak için 3 maddede çok basit şekilde özetler misin?`
- **Beklenen davranış:**
  - RAG, sohbet geçmişindeki son `detailed_answer` metnini bağlama alır.
  - Yeni `short_answer`:
    - 2–3 madde halinde sade Türkçe açıklama,
    - İSG uyarısını ilk maddede korur.
  - Attachments aynı kalır (kaynak sayfalar değişmez).

---

## 7. İş emri modunda yarıda kalan teknisyen (tasarım senaryosu)

- **İlk soru (mode = `work_order`):**  
  `E202 hatası veriyor, makine durdu. Ne yapmalıyım?`
- **İlk cevap:** (Bkz. Senaryo 1) – iş emri adımlarını içeren taslak.
- **Takip sorusu (aynı oturumda):**  
  `3. adımı yaptım, Profibus LED'ler normal görünüyor ama hata devam ediyor. Sonraki neyi kontrol etmeliyim?`
- **Beklenen davranış:**
  - Router, sohbet geçmişinden E202 + önceki iş emrini bağlama alır.
  - Yeni cevap:
    - “Adım 4 ve 5”’teki kontrolleri derinleştirir (örn. hat üzerindeki diğer modüller, güç beslemesi, CPU hata LED’leri).
    - Gerekirse “Operatör panelinde kayıtlı diğer hata mesajlarını da not al” gibi ek öneriler.
  - İş emri taslağında opsiyonel güncelleme önerileri: ek adım/yorum şeklinde.

---

## 8. İşini farklı şekilde çözen ve hafızaya kayıt isteyen teknisyen (tasarım senaryosu)

- **Önceki bağlam:** YV90 valfi ile ilgili arıza (Senaryo 2).
- **Teknisyenin mesajı (özet):**
  - `Senin önerdiğinden farklı olarak YV90'ı sökmeden önce sadece bobin soketini temizledim ve bağlantıyı yeniledim, arıza düzeldi. Bu yöntemi de şirket hafızasına ekleyelim.`
- **Beklenen davranış:**
  - Model:
    - Önce İSG ve üretici tavsiyelerini tekrar hatırlatır.
    - Ardından bu saha deneyimini adımlı şekilde yeniden yazar:
      - “1) Enerjiyi kes, 2) Bobin soketini kontrol et ve temizle, 3) Tekrar bağla, 4) Deneme çalıştırması yap.”
  - API tarafında, ileride `add_to_chroma(...)` gibi bir endpoint açıldığında:
    - `hata_kodu = 'YV90'`, `title`, `description`, `isg_checks`, `ekipman`, `author` parametreleriyle şirket hafızasına yeni bir “Saha Çözümü” gömülmesi planlanabilir.

---

Bu senaryolar, AI Chatbot ve Bakım AI Konsolu’nun birlikte çalışırken nasıl davranması gerektiğini (mod seçimi, hata kodu tespiti, RAG kaynakları, iş emri üretimi ve saha hafızası entegrasyonu) doğrulamak için kullanılabilir. Yeni senaryolar ortaya çıktıkça bu dosya genişletilebilir.

