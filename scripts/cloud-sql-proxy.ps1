# Cloud SQL Auth Proxy - Migration icin
# 1. Proxy indir: https://cloud.google.com/sql/docs/mysql/connect-auth-proxy#install
# 2. hvworkcloud1 ile gcloud auth login yap
# 3. Bu script'i calistir (ayri terminalde arka planda)
# 4. Baska terminalde: cd backend; npx prisma migrate deploy

$ConnectionName = "bhmcontrol:us-central1:bhmdb"  # GCP Console'dan kontrol et
$Port = 3307

Write-Host "Cloud SQL Proxy baslatiliyor: $ConnectionName -> localhost:$Port" -ForegroundColor Cyan
Write-Host "Proxy acik kalsin, diger terminalde: cd backend; npx prisma migrate deploy" -ForegroundColor Yellow

& "$PSScriptRoot\..\bin\cloud_sql_proxy.exe" -instances="$ConnectionName=tcp:$Port" 2>$null
if (-not $?) {
    Write-Host "cloud_sql_proxy bulunamadi. Manuel: cloud_sql_proxy -instances=$ConnectionName=tcp:$Port" -ForegroundColor Red
}
