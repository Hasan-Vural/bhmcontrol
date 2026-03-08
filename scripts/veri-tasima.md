# Local DB → Cloud SQL Veri Taşıma + HeidiSQL Bağlantı

## 1. Veri Taşıma (Tek Seferlik)

### Gereksinim
- MySQL client (`mysqldump`, `mysql`) — XAMPP/WAMP/MySQL kurulumundan
- Local: `bakim_destek` veritabanı (verilerle dolu)
- Cloud: `bakim_destek` (migration uygulanmış, boş veya kısmen dolu)

### Adımlar

**A) Export (local'den)** — PowerShell veya CMD:
```powershell
# XAMPP: C:\xampp\mysql\bin\mysqldump.exe
# WAMP: C:\wamp64\bin\mysql\mysql8.x\bin\mysqldump.exe
mysqldump -h localhost -u root -p bakim_destek --single-transaction --routines --triggers --no-create-db > backup.sql
```
Şifre yoksa: `-p` sonrası Enter (boş bırak).

**B) Import (Cloud'a)** — `?sslaccept=accept_invalid_certs` gerekebilir, mysql client bazen desteklemez. Alternatif: **Cloud Shell**:
```bash
# backup.sql dosyasını Cloud Shell'e yükle (Upload), sonra:
gcloud sql connect bhmdb --user=root
```
MySQL açılınca:
```sql
USE bakim_destek;
SOURCE /path/to/backup.sql;   -- veya yapıştır
```

**C) Veya doğrudan pipe ile (local'de mysql client varsa):**
```powershell
mysqldump -h localhost -u root bakim_destek --single-transaction --routines --triggers --no-create-db | mysql -h 35.190.202.135 -P 3306 -u bhm_migrate -pTest1234 bakim_destek
```
*(Cloud SQL SSL sorunu olursa Cloud Shell ile import gerekir.)*

---

## 2. HeidiSQL ile Cloud SQL'e Bağlantı (Public IP)

### Bağlantı Ayarları

| Alan | Değer |
|------|-------|
| **Host** | `35.190.202.135` |
| **Port** | `3306` |
| **User** | `bhm_migrate` |
| **Password** | `Test1234` |
| **Database** | `bakim_destek` |

### Alternatif kullanıcı
- **User:** `bhm_app` | **Password:** `Bhm123456`

### SSL
Cloud SQL Public IP için SSL gerekebilir. HeidiSQL’de:
- **SSL** sekmesi → "Use SSL" işaretle
- Sertifika doğrulaması hata verirse: "Skip certificate verification" veya benzeri seçenek (varsa)

### Not
- Cloud SQL **Authorized networks** altında makinenizin IP’si veya `0.0.0.0/0` (tüm IP’ler) tanımlı olmalı.
- `bhm_app` kullanıcısı da kullanılabilir (parola: `Bhm123456`).

---

## 3. Karar 2’ye Kadar: Tam Remote DB

- Uygulama Cloud Run’da çalışırken Cloud SQL’i kullanır (Secret Manager’dan `DATABASE_URL`).
- Local geliştirme için de `.env` ile Cloud SQL’e bağlanabilirsin (Public IP + sslaccept).
- HeidiSQL ile yönetim, tüm işlemler web/cloud üzerinden.
