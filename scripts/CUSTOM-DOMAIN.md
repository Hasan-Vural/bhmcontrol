# Cloud Run Custom Domain Kurulumu

BHM servislerinize özel domain bağlamak için 3 yöntem var. **europe-west1** desteklenir.

---

## Yöntem 1: Cloud Run Domain Mapping (Önerilen – basit)

### Ön koşul

- Sahip olduğunuz bir domain (örn. `bhm.example.com`)
- Domain sahipliğini doğrulayacaksınız

### Adımlar

#### 1. Domain sahipliğini doğrula

```powershell
# Örnek: api.bhmsistem.com veya app.bhmsistem.com kullanacaksanız, base domain = bhmsistem.com
gcloud domains verify bhmsistem.com --project=bhmcontrol
```

Tarayıcıda açılan Search Console sayfasında domain doğrulamasını tamamlayın.

#### 2. Mapping oluştur

```powershell
# Backend (API)
gcloud beta run domain-mappings create --service bhm-api --domain api.bhmsistem.com --region=europe-west1 --project=bhmcontrol

# Frontend (Web)
gcloud beta run domain-mappings create --service bhm-web --domain app.bhmsistem.com --region=europe-west1 --project=bhmcontrol
```

#### 3. DNS kayıtlarını al ve ekle

```powershell
gcloud beta run domain-mappings describe --domain api.bhmsistem.com --region=europe-west1 --project=bhmcontrol
```

Çıktıdaki `resourceRecords` bölümündeki A, AAAA veya CNAME kayıtlarını domain sağlayıcınızda (GoDaddy, Namecheap, Cloudflare vb.) tanımlayın.

#### 4. Frontend’te API URL güncellemesi

Custom domain kullandıktan sonra `frontend/cloudbuild.yaml` içindeki `_VITE_API_BASE_URL` değerini güncelleyin:

```yaml
_VITE_API_BASE_URL: 'https://api.bhmsistem.com/api'
```

Sonra frontend’i yeniden deploy edin.

---

## Yöntem 2: Firebase Hosting

Statik içerik + dinamik Cloud Run birlikte kullanılacaksa uygun. [Firebase Hosting + Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) dokümanına bakın.

---

## Yöntem 3: Global Load Balancer

Daha fazla kontrol, CDN, WAF vb. için kullanılır. [Setup guide](https://cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless) adımlarını izleyin.

---

## Desteklenen bölgeler (Cloud Run Domain Mapping)

- europe-west1 ✓ (BHM burada)
- us-central1, us-east1, europe-west4 vb.
