# Cloud SQL + Prisma Migration: Olası Hatalar ve Çözümleri

Bu doküman `docs/plans/general-deployment-logic.md` ile birlikte kullanılır. Cloud SQL ve Prisma migration sırasında karşılaşılan hatalar ve çözümleri içerir.

---

## HeidiSQL: Access denied for user 'bhm_migrate'@'IP' using password: YES

**Hata:** HeidiSQL ile public Cloud SQL'e bağlanırken "Connection failed - Access denied" alıyorsunuz.

**Olası nedenler ve çözümler:**

1. **Authorized networks (IP izin listesi):** Cloud SQL, sadece izin verilen IP'lerden gelen bağlantıları kabul eder.
   - **Google Cloud Console** → **SQL** → örnek (örn. bhmdb) → **Connections** (Bağlantılar)
   - **Authorized networks** → **Add network** → Kendi IP'nizi ekleyin (örn. `78.18.x.x/32`)
   - IP öğrenmek için: https://whatismyip.com

2. **Kullanıcı yetkisi:** `bhm_migrate` kullanıcısı her IP'den erişime izinli olmayabilir.
   - Cloud Shell'de: `gcloud sql connect bhmdb --user=root`
   - Root şifresini girin, sonra:
   ```sql
   CREATE USER IF NOT EXISTS 'bhm_migrate'@'%' IDENTIFIED BY 'Test1234';
   GRANT ALL PRIVILEGES ON bakim_destek.* TO 'bhm_migrate'@'%';
   FLUSH PRIVILEGES;
   ```

3. **Parola:** `.env` içindeki `Test1234` doğru olmayabilir. Yukarıdaki SQL ile parolayı güncelleyebilirsiniz.

---

## IP Sürekli Değişiyor – Cloud SQL Auth Proxy (Önerilen Çözüm)

**Kök neden:** Ev/ofis internet bağlantıları genelde dinamik IP kullanır (DHCP). Her bağlantıda farklı IP alındığı için Authorized networks'e sürekli yeni IP eklemek gerekir.

**Çözüm:** Cloud SQL Auth Proxy kullanın. Proxy, gcloud kimliğinizle güvenli tünel oluşturur; **IP whitelist gerekmez**. HeidiSQL ile `127.0.0.1` üzerinden bağlanırsınız.

### Adımlar

1. **Proxy indir (Windows):**
   - https://cloud.google.com/sql/docs/mysql/connect-auth-proxy#install
   - `cloud_sql_proxy_x64.exe` dosyasını indirip bir klasöre koy (örn. `C:\cloud-sql-proxy\`).

2. **gcloud ile giriş:**
   ```bash
   gcloud auth application-default login
   ```

3. **Instance connection name bul:** Cloud Console → SQL → Örneğinize tıkla → **Connection name** (örn. `proje-id:europe-west1:bhmdb`).

4. **Proxy'yi başlat:**
   ```bash
   cloud_sql_proxy_x64.exe -instances=PROJE_ID:BÖLGE:INSTANCE_ADI=tcp:3307
   ```
   Örnek:
   ```bash
   cloud_sql_proxy_x64.exe -instances=my-project:europe-west1:bhmdb=tcp:3307
   ```
   Terminalde "Ready for new connections" yazısı görünene kadar bekleyin.

5. **HeidiSQL bağlantı ayarları:**
   | Alan | Değer |
   |------|-------|
   | Sunucu | `127.0.0.1` |
   | Port | `3307` |
   | Kullanıcı | `bhm_migrate` |
   | Parola | `Test1234` |
   | Veritabanı | `bakim_destek` |
   | SSL | **Kapalı** (proxy zaten şifreli tünel kullanır) |

Proxy çalışır durumdayken IP değişse bile HeidiSQL bağlantısı çalışır.

---

## P1000: Authentication failed

**Hata:** `The provided database credentials for 'user' are not valid`

**Çözümler:**

1. **DATABASE_URL formatı (forum çözümü):** `user:password@host` formatında parola zorunludur.
   ```
   mysql://KULLANICI:PAROLA@HOST:3306/veritabani
   ```

2. **Cloud SQL Public IP + SSL:** Direct bağlantıda TLS sertifika hatası alınırsa ekle:
   ```
   ?sslaccept=accept_invalid_certs
   ```
   Örnek: `mysql://bhm_app:Parola123@35.190.202.135:3306/bakim_destek?sslaccept=accept_invalid_certs`

3. **Yeni kullanıcı oluştur (Cloud Shell):**
   ```sql
   CREATE USER 'bhm_app'@'%' IDENTIFIED BY 'GucluParola123';
   GRANT ALL PRIVILEGES ON bakim_destek.* TO 'bhm_app'@'%';
   FLUSH PRIVILEGES;
   ```
   MySQL 8.4+ için `mysql_native_password` kullanma; varsayılan auth kullanılır.

---

## P1010: User was denied access on the database `mysql`

**Hata:** Cloud SQL, `mysql` sistem veritabanına erişimi kısıtlıyor. Prisma migrate deploy bu yüzden başarısız olur.

**Çözüm:**

1. **Veritabanını önce oluştur:** Cloud Console → Cloud SQL → Databases → Create: `bakim_destek`

2. **`prisma migrate resolve` kullan:** Migration zaten uygulandıysa veya manuel SQL çalıştırıldıysa:
   ```bash
   npx prisma migrate resolve --applied "MIGRATION_ADI"
   ```

3. **Manuel migration (Cloud Shell):** Root ile MySQL'e bağlan, schema SQL'i çalıştır:
   ```bash
   gcloud sql connect INSTANCE_ADI --user=root
   ```
   ```sql
   CREATE DATABASE IF NOT EXISTS bakim_destek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE bakim_destek;
   -- scripts/full-schema.sql içeriğini yapıştır veya source ile çalıştır
   ```

---

## P1003: Database does not exist

**Hata:** `Database 'bakim_destek' does not exist`

**Çözüm:** Cloud SQL'de veritabanı oluştur:
- Cloud Console → Cloud SQL → bhmdb → Databases → Create database: `bakim_destek`
- veya Cloud Shell: `CREATE DATABASE bakim_destek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

---

## Cloud SQL Proxy: Port already in use

**Hata:** `bind: address already in use` (port 9470 vb.)

**Çözüm:**
```bash
# Farklı port kullan
gcloud sql connect bhmdb --user=root --port=3308

# Veya mevcut proxy sürecini kapat
pkill -f cloud-sql-proxy
```

---

## Cloud SQL Proxy: Dosya kilitli (Windows)

**Hata:** `Dosya başka bir işlem tarafından kullanıldığından...`

**Çözüm:**
- Proxy zaten çalışıyor olabilir → migration'ı deneyebilirsin (`127.0.0.1:3307`)
- Veya proxy'yi farklı klasöre indirip (örn. Masaüstü) oradan çalıştır
- Görev Yöneticisi'nden `cloud_sql_proxy` sürecini sonlandır

---

## Özet: Cloud SQL Migration Akışı (Önerilen)

1. Cloud SQL'de `bakim_destek` veritabanını oluştur
2. `bhm_app` veya `bhm_migrate` kullanıcısı oluştur, `bakim_destek.*` yetkisi ver
3. `.env`: `DATABASE_URL="mysql://KULLANICI:PAROLA@PUBLIC_IP:3306/bakim_destek?sslaccept=accept_invalid_certs"`
4. `npx prisma migrate deploy` — P1010 alırsan → `migrate resolve --applied` veya manuel SQL
