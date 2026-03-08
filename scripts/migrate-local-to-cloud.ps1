# Local MySQL verilerini Cloud SQL'e tasir
# Kullanim: .\migrate-local-to-cloud.ps1 -LocalDb "bakim_destek" -CloudIp "35.190.202.135" -CloudUser "root" -CloudDb "bakim_destek"
param(
    [string]$LocalDb = "bakim_destek",
    [string]$LocalUser = "root",
    [string]$LocalHost = "localhost",
    [string]$LocalPort = "3306",
    [string]$CloudIp = "",
    [string]$CloudUser = "root",
    [string]$CloudDb = "bakim_destek",
    [string]$CloudPassword = ""
)

if (-not $CloudIp) {
    Write-Host "Hata: Cloud SQL Public IP gerekli. Ornek: -CloudIp '35.190.202.135'" -ForegroundColor Red
    exit 1
}

if (-not $CloudPassword) {
    $CloudPassword = Read-Host "Cloud SQL sifresini girin" -AsSecureString
    $CloudPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($CloudPassword))
} else {
    $CloudPasswordPlain = $CloudPassword
}

$ExportFile = "bakim_destek_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

Write-Host "1. Local MySQL'den export ediliyor ($LocalHost:$LocalPort/$LocalDb)..." -ForegroundColor Cyan
# mysqldump - local'den
# Windows'ta mysql client yoksa: https://dev.mysql.com/downloads/mysql/ veya XAMPP/WAMP ile gelen mysql\bin\mysqldump kullan
$MysqlPath = $env:PATH -split ";" | ForEach-Object { Join-Path $_ "mysqldump.exe" } | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $MysqlPath) {
    $MysqlPath = "mysqldump"  # PATH'te varsa
}

try {
    & mysqldump -h $LocalHost -P $LocalPort -u $LocalUser $LocalDb --single-transaction --routines --triggers > $ExportFile
    Write-Host "   Export tamam: $ExportFile" -ForegroundColor Green
} catch {
    Write-Host "Hata: mysqldump bulunamadi veya calismadi. MySQL client yukleyin veya Git Bash'te asagidaki komutu kullanin:" -ForegroundColor Red
    Write-Host "  mysqldump -h localhost -u root bakim_destek --single-transaction --routines --triggers > $ExportFile" -ForegroundColor Yellow
    exit 1
}

Write-Host "2. Cloud SQL'e import ediliyor ($CloudIp/$CloudDb)..." -ForegroundColor Cyan
try {
    Get-Content $ExportFile | & mysql -h $CloudIp -P 3306 -u $CloudUser -p$CloudPasswordPlain $CloudDb
    Write-Host "   Import tamam." -ForegroundColor Green
} catch {
    Write-Host "Hata: mysql import basarisiz. Manuel:" -ForegroundColor Red
    Write-Host "  mysql -h $CloudIp -u $CloudUser -p $CloudDb < $ExportFile" -ForegroundColor Yellow
    exit 1
}

Write-Host "3. Gecici dosya siliniyor..." -ForegroundColor Cyan
Remove-Item $ExportFile -ErrorAction SilentlyContinue
Write-Host "Veri tasima tamamlandi." -ForegroundColor Green
