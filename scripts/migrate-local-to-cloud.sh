#!/bin/bash
# Local MySQL -> Cloud SQL veri tasima
# Kullanim: ./migrate-local-to-cloud.sh
# .env'den veya env'den: LOCAL_DB_URL, CLOUD_DB_URL

set -e

LOCAL_DB="${LOCAL_DB:-bakim_destek}"
LOCAL_USER="${LOCAL_USER:-root}"
LOCAL_HOST="${LOCAL_HOST:-localhost}"
CLOUD_IP="${CLOUD_IP:?Cloud SQL IP gerekli: CLOUD_IP=35.x.x.x"}
CLOUD_USER="${CLOUD_USER:-root}"
CLOUD_DB="${CLOUD_DB:-bakim_destek}"
EXPORT_FILE="bakim_destek_export_$(date +%Y%m%d_%H%M%S).sql"

echo "1. Export: $LOCAL_HOST/$LOCAL_DB -> $EXPORT_FILE"
mysqldump -h "$LOCAL_HOST" -u "$LOCAL_USER" "$LOCAL_DB" \
  --single-transaction --routines --triggers > "$EXPORT_FILE"

echo "2. Import: $CLOUD_IP/$CLOUD_DB"
read -sp "Cloud SQL sifresi: " CLOUD_PASS
echo
mysql -h "$CLOUD_IP" -P 3306 -u "$CLOUD_USER" -p"$CLOUD_PASS" "$CLOUD_DB" < "$EXPORT_FILE"

echo "3. Temizlik"
rm -f "$EXPORT_FILE"
echo "Tamamlandi."
