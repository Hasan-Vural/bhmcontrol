# MySQL Veritabanı Kurulumu

## 1. MySQL'e Bağlanın

```bash
mysql -u root -p
```

(Şifrenizi girin)

## 2. Veritabanını Oluşturun

MySQL komut satırında şunu çalıştırın:

```sql
CREATE DATABASE bakim_destek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Not:** Eğer `utf8mb4_unicode_ci` çalışmazsa, şunu deneyin:
```sql
CREATE DATABASE bakim_destek CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

Veya daha basit (MySQL otomatik seçer):
```sql
CREATE DATABASE bakim_destek;
```

## 3. Kullanıcı Oluşturun (Opsiyonel - Güvenlik İçin)

```sql
CREATE USER 'bakim_user'@'localhost' IDENTIFIED BY 'güvenli_şifre_buraya';
GRANT ALL PRIVILEGES ON bakim_destek.* TO 'bakim_user'@'localhost';
FLUSH PRIVILEGES;
```

## 4. .env Dosyasını Güncelleyin

Eğer root kullanıcısı kullanıyorsanız:
```
DATABASE_URL="mysql://root:şifreniz@localhost:3306/bakim_destek"
```

Eğer yeni kullanıcı oluşturduysanız:
```
DATABASE_URL="mysql://bakim_user:güvenli_şifre_buraya@localhost:3306/bakim_destek"
```

## 5. Prisma Migration Çalıştırın

```bash
cd backend
npx prisma migrate dev
npm run db:seed
```

## Alternatif: Tek Komutla (MySQL CLI)

Eğer MySQL komut satırından çalıştırmak istiyorsanız:

```bash
mysql -u root -p -e "CREATE DATABASE bakim_destek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
