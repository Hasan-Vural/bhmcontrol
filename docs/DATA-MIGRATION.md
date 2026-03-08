# Local DB → Cloud SQL Veri Tasima

Local MySQL'deki verileri Cloud SQL'e tek seferlik tasir.

## Onkosullar

- MySQL client (`mysqldump`, `mysql`) yuklu
- Cloud SQL instance acik, Public IP aktif
- Cloud SQL'de `bakim_destek` veritabani olusturulmus (ilk migration icin bos olabilir)

## Yontem 1: Manuel komutlar

### 1. Export (local)

```bash
mysqldump -h localhost -u root -p bakim_destek --single-transaction --routines --triggers > backup.sql
```

### 2. Cloud SQL'de veritabani olustur (ilk kez)

Cloud Console → Cloud SQL → bhm-mysql → Databases → Create database: `bakim_destek`

### 3. Import (Cloud)

```bash
mysql -h CLOUD_SQL_IP -P 3306 -u root -p bakim_destek < backup.sql
```

## Yontem 2: Script (Git Bash / WSL)

```bash
cd scripts
export CLOUD_IP=35.190.202.135   # Cloud SQL Public IP
./migrate-local-to-cloud.sh
```

## Yontem 3: PowerShell

```powershell
.\scripts\migrate-local-to-cloud.ps1 -CloudIp "35.190.202.135"
# Sifre istendiginde Cloud SQL root sifresini gir
```

## Migration'lari Cloud'da calistirma

Cloud Build / Cloud Run her deploy'da otomatik `prisma migrate deploy` calistirir (backend baslarken).
Ilk kez schema yoksa, once veri tasima yapip sonra deploy edebilirsin; ya da bos DB ile deploy edip migration'lari baslatsin, sonra veri tasirsin.

**Onerilen sira:**
1. Cloud SQL instance olustur, `bakim_destek` DB olustur
2. `prisma migrate deploy` schema'yi kurar (veya veri tasima ile birlikte schema da gider)
3. Local'den mysqldump → Cloud'a import
4. Backend deploy (migrate deploy zaten calisacak, mevcut schema uzerine ek migration varsa uygular)
