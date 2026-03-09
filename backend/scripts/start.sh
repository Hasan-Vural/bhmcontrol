#!/bin/sh
set -e
# Migrate'i arka planda çalıştır; container hemen 8080'de dinlesin (Cloud Run timeout'u aşmasın)
npx prisma migrate deploy &
exec node src/index.js
