----Güncel versiyon sorular ve cevaplar---- 
AJ100 (PNOZ-MOP) güvenlik modülü şemasına (Sayfa 9) göre; T0 ve T1 çıkışlarından başlayan güvenlik zincirinde, SQ11A ve SQ11C sensörlerinden geçen sinyaller (ka
blo 084 ve 085), AJ100 modülünün hangi INPUT (Giriş) numaralarına (Örn: 14, 15, 112 vb.) geri dönmektedir ?

💡 CEVAP:
⚠️ **İSG UYARISI:** Güvenlik modülleri (PNOZ) ve bunlara bağlı güvenlik sensörleri (SQ) üzerinde yapılacak her türlü müdahale, makine enerjisizken ve yetkili teknik personel taraf
ından yapılmalıdır. Güvenlik zincirinin baypas edilmesi veya hatalı kablajlanması, geri dönüşü olmayan ciddi iş kazalarına ve ekipman hasarına yol açabilir.

Merhaba, sahadaki durumu anlıyorum. AJ100 (PNOZ-MOP) güvenlik modülü üzerindeki giriş-çıkış takibini yapmak arıza tespiti için kritiktir. İstediğin bilgiler doğrultusunda, **Sayfa
 9 (RIEPILOGO CATENE SICUREZZE)** üzerindeki şemayı incelediğimde veriler şu şekildedir:

**AJ100 (PNOZ-MOP) Güvenlik Modülü Giriş Bilgileri:**

1.  **SQ11A Sensörü ve 084 nolu Kablo:**
    *   T1 çıkışından beslenen güvenlik zinciri üzerinde bulunan SQ11A sensöründen geçen **084** numaralı kablo sinyali, AJ100 modülünün **I12** (Input 12) numaralı girişine geri 
dönmektedir.

2.  **SQ11C Sensörü ve 085 nolu Kablo:**
    *   Yine aynı hat üzerinde bulunan SQ11C sensöründen geçen **085** numaralı kablo sinyali, AJ100 modülünün **I13** (Input 13) numaralı girişine geri dönmektedir.

**Özet Tablo:**

| Sensör | Kablo No | AJ100 Giriş (INPUT) No |
| :--- | :--- | :--- |
| **SQ11A** | 084 | **I12** |
| **SQ11C** | 085 | **I13** |

**Teknik Not:** Sayfa 137'deki lojik tablosuna göre bu sensörler "ceppi fuori" (takozlar dışarıda) konumunu denetleyen mikroşalterlerdir. Eğer modül üzerinde I12 veya I13 LED'leri
nden biri yanmıyorsa, ilgili sensörün (SQ11A veya SQ11C) mekanik olarak basılı olup olmadığını veya kablo sürekliliğini kontrol etmeni öneririm.

Başka bir ölçüm veya klemens numarası lazımsa buradayım evlat, kolay gelsin.

Elektrik projesinin 48. sayfasında yer alan Klima/Soğutucu (Condizionatore) şemasına göre; eğer sistemde 'TX050' model termostat takılıysa 'Par. AL' parametresi hangi değere ayarlanmalıdır? Ayrıca bu soğutma sistemi ortam sıcaklığı kaç dereceyi aştığında devreye girmektedir?

**İSG UYARISI:** Elektrik panosu ve klima ünitesi (Condizionatore) içerisinde yapılacak her türlü parametre değişikliği veya teknik müdahale öncesinde sistem enerjisinin kesild
iğinden ve uygun "Kilitle-Etiketle" (LOTO) prosedürlerinin uygulandığından emin olunmalıdır.

Elektrik projesinin **48. sayfasında** yer alan *"IMPOSTAZIONI PARAMETRI TERMOSTATO EV115"* (EV115 Termostat Parametre Ayarları) tablosundaki verilere göre;

Eğer sistemde **TX050** model termostat takılıysa:

*   **Par. AL** parametresinin değeri: **5** olmalıdır.

Aynı tabloda TX050 modeli için diğer referans değerler ise şu şekilde belirtilmiştir:
*   Par. AA = Ab
*   Par. AU = 50
*   Par. At = AU
*   Par. rA = AU
*   Par. AP = OP
⚠️ **İSG UYARISI:** Elektrik panosu ve klima ünitesi (Condizionatore) içerisinde yapılacak her türlü parametre değişikliği veya teknik müdahale öncesi sistemin ana enerjisini kesi
n ve "Kilitle-Etiketle" (LOTO) prosedürlerini uygulayın. Pano içerisinde yüksek gerilim (400V) ve hareketli parçalar (fanlar) bulunmaktadır.

Sahadaki kıdemli bir mühendis olarak, dokümanlardaki teknik veriler ışığında sorunuzu yanıtlıyorum:

**1. Par. AL Değeri:**
Elektrik projesinin 48. sayfasında (Sheet 48) yer alan **"IMPOSTAZIONI PARAMETRI TERMOSTATO EV115"** (Termostat EV115 Parametre Ayarları) tablosuna göre; sistemde **'TX050'** mode
l termostat takılıysa, **Par. AL** parametresi **"5"** değerine ayarlanmalıdır.

**2. Soğutma Sisteminin Devreye Girme Sıcaklığı:**
Yine aynı sayfa (Sayfa 48) üzerindeki EV115 Klima/Soğutucu (Condizionatore) şemasında, termostatın ayar noktası (setpoint) için net bir talimat bulunmaktadır:
*   Şema üzerinde termostat sembolünün hemen yanında **"TARARE 45°C"** (45°C'ye kalibre et/ayarla) notu yer almaktadır.

Bu verilere göre, soğutma sistemi ortam sıcaklığı **45°C**'yi aştığında devreye girecek şekilde ayarlanmıştır. Ayrıca aynı sayfanın notlar kısmında (Note 1) bu ünitenin ortam sıca
klığının 42°C'den (Maggiore di 42°C) büyük olduğu durumlar için öngörüldüğü de teknik bir detay olarak belirtilmiştir.

Özetle; **Par. AL = 5** ve devreye girme sıcaklığı **45°C**'dir. Başka bir arıza veya parametre kontrolü gerekiyorsa şemalar üzerinden devam edebiliriz.


Yv90 nedir ? 
💡 CEVAP:
⚠️ **İSG UYARISI:** Elektrovalfler (YV) ve hidrolik sistemler üzerinde yapılacak müdahaleler; yüksek basınçlı akışkan ve elektrik akımı içerir. Çalışmaya başlamadan önce sistemin hidrolik basıncını tahliye ettiğinizden, makine enerjisini kestiğinizden ve LOTO (Kilitle-Etiketle) prosedürlerini uyguladığınızdan emin olun.

**Sohbet Akışına ve Dokümanlara Göre Yanıt:**
Sohbet geçmişimizde bahsettiğimiz AJ100 (PNOZ) güvenlik modülü ve güvenlik zinciri bağlamında sorunu değerlendirdiğimde ve paylaştığın **SERAMİK MAKİNELERİN YAĞLAMA ŞEMASI (Sayfa 8, 9, 14, 19, 20, 21)** dokümanlarını incelediğimde şu sonuçlara ulaşıyorum:
1. **Doküman Analizi:** Sana ait referans dokümanlarda (Yağlama Şeması ve Karşılaştırmalı Tablolar) **"yv90"** isimli bir bileşen, yağ kodu veya gres tipi **bulunmamaktadır.** Bu 
dokümanlar sadece mekanik aksamın yağlama noktalarını (MTR, PCH, PCR, MTC, MTD makineleri) ve kullanılacak yağlayıcıların (Agip, Mobil, Shell vb.) marka karşılıklarını içerir.    
2. **Teknik Tanımlama (Kıdemli Mühendis Notu):** Sahadaki teknik terminolojiye ve bir önceki sorundaki güvenlik modülü (PNOZ) bağlamına göre; **"YV"** kodu genellikle bir **Elektr
ovalfi (Solenoid Valve)** temsil eder.
3. **Bağlantılı Sistem:**   * Sayfa 9'daki yağlama kartına göre; **PCH (Ön Sıkıştırma İçin Hidrolik Pres)** ve **PCR (Silindirli Önsıkıştırıcı)** gibi ünitelerde "Oledinamik Tesisat" (Hidrolik Sistem) bulunmaktadır.   * "yv90" muhtemelen bu hidrolik ünitelerin veya güvenlik zincirine (PNOZ) bağlı olan bir hattın kontrolünü sağlayan **hidrolik elektrovalftir.****Sonuç:** "yv90", elindeki yağlama listesinde bir yağlama noktası veya yağ tipi olarak tanımlanmamıştır. Bu kod, makinenin **Hidrolik veya Pnömatik Devre Şeması** üzerinde araman gereken bir kontrol valfidir. Eğer bu valfin bulunduğu sistemin yağ tipini merak ediyorsan; dokümana göre bu hidrolik sistemlerde (Sayfa 9, madde 18) **18 numaralı** yağ (yağ özelliklerini içeren sayfa 15'e atıf yapılarak) kullanılmaktadır.

------------------------------------------------------------
Soru (Çıkış: 'q'):





Sistemdeki tüm akümülatörlerin toplam hacmi (Litre bazında) nedir ve her birinin çalışma basıncı aynı mıdır?"

💡 CEVAP:
⚠️ **İSG UYARISI:** Akümülatörler yüksek basınçlı azot gazı (N2) ve hidrolik yağ içermektedir. Sistem üzerinde herhangi bir sökme, bakım veya vana müdahalesi yapmadan önce sistem 
basıncının tamamen boşaltıldığından emin olunmalıdır. Akümülatörlerin ön dolumu için kesinlikle hava veya oksijen kompresörü kullanılmamalı, sadece redüktörlü kuru azot tankı kull
anılmalıdır (Kaynak: Sayfa 92).

Sahadaki teknik incelememe ve bana sunduğun dokümanlardaki verilere dayanarak sorunu şu şekilde yanıtlıyorum:

### 1. Sistemdeki Akümülatörler ve Toplam Hacim
Dokümanlarda sistemde yer alan akümülatörler kodları ve bağlı oldukları devrelerle tanımlanmıştır. Ancak, **verilen referans metinlerde bu akümülatörlerin her birinin kaçar "Litre
" kapasiteye sahip olduğu bilgisi yer almamaktadır.** "Dokümana Sadakat" kuralım gereği, teknik çizelgelerde bulunmayan bir hacim (Litre) değerini uyduramam.

Sistemde tanımlanan akümülatör grupları şunlardır:
*   **Kumanda Plakası Akümülatörleri:** 18, 18a ve 18b (153 nolu vana/tapa ile boşaltılır).
*   **Servis Plakası Akümülatörü:** 12 (153a nolu tapa ile boşaltılır).
*   **Opsiyonel Akümülatörler (SFS ve Ayna Kalıp):** 141 ve 337 nolu akümülatörler (varsa 143 ve 339 nolu vanalarla boşaltılır).

### 2. Çalışma Basınçları Aynı mıdır?
"Bilgi Düzleşmesi" yapmadan detaylara baktığımızda; her ne kadar ana sistem basıncı ortak bir kaynaktan beslense de, her bir akümülatör grubunun veya devresinin çalışma ve emniyet
 ayarları uygulama alanına göre farklılıklar göstermektedir:

*   **Genel Sistem Basınçları (PH3800/PH5000 Serisi):**
    *   **Emniyet Basıncı:** 250 Bar.
    *   **Çalışma Basıncı (Hat Basıncı):** 230 Bar olarak kalibre edilmiştir (Kaynak: Sayfa 182).
    *   **Pompa Boşta (YV99 Kapalı):** Hat basıncı 20 Bar seviyesindedir (Kaynak: Sayfa 183).

*   **Alt Devre Farklılıkları ve Ayarlar:**
    *   **Baskı Kumanda Devresi (166 Redüktörü):** Akümülatör yeniden doldurma süreci sonunda, Manometre 198 (hat basıncı) ile Manometre 196 (redüktör sonrası) arasında bir fark v
ardır. Örneğin; Manometre 198'de 115 Bar okunurken, 166 nolu redüktör Manometre 196'da 96 Bar'a ayarlanır. Yani bu alt devre, ana hat basıncından daha düşük, kontrollü bir basınçl
a çalışır (Kaynak: Sayfa 117).
    *   **Maksimum Basınç Valfleri:** Sistemde farklı noktalar için farklı emniyet valfleri bulunur:
        *   **112a:** Servis devresi maksimum basınç valfi.
        *   **228:** Presleyici travers emniyet valfi.
        *   **352:** Çoğaltıcı (multiplier) maksimum basınç valfi (Kaynak: Sayfa 73).
    *   **Pnömatik Devre (Hava):** Akümülatörlerle karıştırılmaması gereken hava tankı devresi, hidrolik devreden tamamen farklı olarak 1,2 Bar ile -0,5 Bar (vakum etkisi) arasınd
a bir basınç altında tutma/düşürme rejimiyle çalışır (Kaynak: Sayfa 62).

**Özetle:** Tüm akümülatörlerin çalışma basıncı aynı değildir. Ana hat akümülatörleri 230 Bar çalışma basıncına göre ayarlanırken, baskı kumanda gibi alt devrelerdeki akümülatör g
rupları (166 redüktörü üzerinden) tabloya göre daha düşük ve kademeli basınçlarda görev yapar. Toplam hacim (L) bilgisi için teknik spesifikasyon tablosuna veya parça listesine (P
art List) bakmamız gerekecektir, mevcut dokümanda bu rakam bulunmamaktadır.

------------------------------------------------------------
Soru (Çıkış: 'q'):



PH5000LB presi için tavsiye edilen hidrolik yağ viskozite değerleri sıcaklığa göre nasıl değişmektedir?

� CEVAP:
⚠️ **İSG UYARISI:** PH5000LB presinin hidrolik sistemi 230 bar gibi yüksek çalışma basınçlarına ve operasyonel sıcaklıklara ulaşmaktadır. Yağ sıcaklığı 60°C'ye ulaştığında emniyet
 termostatı (T18) sistemi bloke eder. Sıcak yağ ile temas ciddi yanıklara yol açabilir; sistem basınç altındayken veya yüksek sıcaklıktayken rekor ve boru bağlantılarına müdahale 
edilmemelidir.

Saha tecrübelerimiz ve referans dokümanlar ışığında, PH5000L serisi presler için tavsiye edilen **ISO VG 46 (HLP 46)** tipi hidrolik yağın viskozite değerlerinin sıcaklığa bağlı d
eğişimi ve operasyonel limitleri aşağıda belirtilmiştir:

### 1. Sıcaklığa Göre Kinematik Viskozite Değerleri (ISO VG 46)
Referans yağlama kartına (200.02.A01) göre, mineral veya sentetik bazlı çinko içermeyen yağın sıcaklık değişimindeki viskozite karakteristikleri şu şekildedir:

*   **0°C’de:** Maksimum **780 mm²/s (cSt)** (Çok yüksek viskozite, akışkanlık düşüktür).
*   **40°C’de (Referans Noktası):** Minimum **41.4 mm²/s** ile Maksimum **50.6 mm²/s** aralığında olmalıdır. (Sistemin ideal çalışma viskozite değeridir).
*   **100°C’de:** Minimum **6.1 mm²/s** (Viskozite aşırı düşer, yağlama filmi zayıflar).
*   **Viskozite Endeksi:** Yağın sıcaklık değişimine karşı direncinin **110'dan büyük (>110)** olması şarttır.

### 2. Sıcaklık Yönetimi ve Operasyonel Limitler
Presin stabil çalışması için yağ sıcaklığının **40°C civarında sabit tutulması** hayati önem taşır. Kontrol sistemi bu dengeyi şu eşiklerle yönetir:

*   **Kritik Alt Sınır (< 2°C):** Yağ sıcaklığı 2°C'nin altındaysa, kontrol sistemi ana motorun (M1) çalıştırılmasını tamamen engeller.
*   **Harici Isıtma Eşiği (< 5°C):** Sıcaklık 5°C'nin altındaysa, opsiyonel ek ısıtma sistemi (M18 pompa ve EH18 rezistans) devreye girer. Sıcaklık 5°C'ye ulaşmadan filtrasyon ve 
ana motorun çalışmasına izin verilmez.
*   **Otomatik Hızlı Isıtma (< 30°C):** Yağ 30°C'nin altındaysa, sistem "otomatik ısıtma" moduna geçer. Pompalar yağı **150 bar** basınçta sirküle ederek elektrik enerjisini ısıya
 dönüştürür.
*   **Soğutma Çevrimi (Isı Değiştirici):**
    *   **41°C:** Yağ sıcaklığı bu değere ulaştığında soğutma suyu vanası (YV279) açılır.
    *   **39°C:** Sıcaklık bu değere düştüğünde soğutma kesilir.

### 3. Önemli Teknik Notlar
*   **Yağ Tipi:** Mutlaka **çinko ihtiva etmeyen (zinc-free)** yağlar kullanılmalıdır. Contalarla uyum sorunu yaratabileceği için dış (Hees) bazlı yağlar tavsiye edilmez.
*   **Temizlik:** Sisteme yüklenecek yağın ISO 4406:1999 standardına göre **14/12/8** temizlik sınıfında olması, çalışma sırasında ise **19/15/13** seviyesinin aşılmaması gerekir.
*   **Isı Değiştirici:** Soğutma verimliliği için 20°C'de dakikada **80 litre** su sarfiyatı ve maksimum **4 bar** su basıncı öngörülmüştür.

Kıdemli bir not olarak; özellikle kış aylarında veya duruşlardan sonra otomatik öğrenim (offset) işlemlerini yapmadan önce, yağın çalışma sıcaklığına (40°C) ulaşması için makineni
n en az **20 dakika** çalıştırılması gerektiğini unutma.

------------------------------------------------------------
Soru (Çıkış: 'q'):
