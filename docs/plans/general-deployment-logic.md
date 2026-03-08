# Genel Deployment Mantığı (Branch → Trigger → Cloud Run)

Bu dokümanda **herhangi bir proje** için izole ortamlar, **branch → trigger → Cloud Run** ilişkisi ve **preview vs canlı (prod)** akışı özetlenir. Proje adı yerine **`{projectname}`** kullanın (örn. `edura`, `myapp`).

---

## 1. Ortamlar ve anlamları

| Ortam | Açıklama | Frontend servisi | Backend servisi |
|-------|----------|------------------|-----------------|
| **Local** | Geliştirici makinesi (`npm run dev` vb.) | — | — |
| **Preview (Stage)** | Feat branch’lerdeki değişiklikleri test etmek için; canlıdan **izole**. | `{projectname}-web-preview` | `{projectname}-api-preview` |
| **Prod (Canlı)** | Kullanıcıların kullandığı nihai ortam. | `{projectname}-web` | `{projectname}-api` |

- Preview ve prod **ayrı Cloud Run servisleri**; aynı `cloudbuild.yaml` dosyaları, farklı **trigger** ve **substitution** değişkenleriyle kullanılır.
- Backend’de `{projectname}-api` / `{projectname}-api-preview`, frontend’de `{projectname}-web` / `{projectname}-web-preview` isimleri Cloud Run’da servis adı olarak kullanılır.

---

## 2. Branch stratejisi

| Branch | Tetiklenen build’ler | Deploy edilen ortam |
|--------|----------------------|----------------------|
| `feat/*` (örn. `feat/local`, `feat/yeni-ozellik`) | Backend-preview, Frontend-preview | **Preview** (`{projectname}-api-preview`, `{projectname}-web-preview`) |
| `main` | Backend-deploy (prod), Frontend-deploy (prod) | **Prod** (`{projectname}-api`, `{projectname}-web`) |

- **feat branch’e push** → Sadece preview servisleri güncellenir; canlı (prod) **hiç etkilenmez**.
- **main’e push veya merge** → Sadece prod servisleri güncellenir.

Böylece **preview izole** kalır; canlıya geçiş yalnızca `main` üzerinden olur.

---

## 3. Cloud Build trigger’lar (4 adet)

Aynı repo, aynı `backend/cloudbuild.yaml` ve `frontend/cloudbuild.yaml`; fark, **hangi branch** ve **hangi substitution değişkenleri** ile çalıştığıdır.

### 3.1 Prod (canlı)

| Trigger (örnek isim) | Event | Config dosyası | Substitution variables |
|----------------------|--------|----------------|------------------------|
| **{projectname}-backend-deploy** | Push to `^main$` | `backend/cloudbuild.yaml` | `_SERVICE={projectname}-api`, `_REGION=europe-west1` (veya yaml default) |
| **{projectname}-frontend-deploy** | Push to `^main$` | `frontend/cloudbuild.yaml` | `_SERVICE={projectname}-web`, `_REGION=europe-west1`, `_NEXT_PUBLIC_API_URL` = prod API URL’i, `_NEXT_PUBLIC_SOCKET_URL` = prod backend URL’i |

### 3.2 Preview (stage)

| Trigger (örnek isim) | Event | Config dosyası | Substitution variables |
|----------------------|--------|----------------|------------------------|
| **{projectname}-backend-preview** | Push to `^feat/.*` | `backend/cloudbuild.yaml` | `_SERVICE={projectname}-api-preview`, `_REGION=europe-west1` |
| **{projectname}-frontend-preview** | Push to `^feat/.*` | `frontend/cloudbuild.yaml` | `_SERVICE={projectname}-web-preview`, `_REGION=europe-west1`, `_NEXT_PUBLIC_API_URL` = **preview** backend URL’i (`.../api`), `_NEXT_PUBLIC_SOCKET_URL` = **preview** backend URL’i (sonda `/api` yok) |

**Önemli:** Frontend build’i, çalışacağı backend’in URL’ini **build anında** alır. Bu yüzden:

- **Prod frontend** → prod backend URL’leri.
- **Preview frontend** → preview backend URL’leri (`{projectname}-api-preview` servisinin Cloud Run URL’i).

Preview backend’in URL’i ilk deploy’dan sonra belli olur; trigger’da bu URL’i yazıp frontend-preview’ı yeniden build etmek gerekir.

---

## 4. Config dosyası konumları (trigger’da)

- **Backend:** `backend/cloudbuild.yaml` (veya repo root’a göre `/backend/cloudbuild.yaml`).
- **Frontend:** `frontend/cloudbuild.yaml` (veya `/frontend/cloudbuild.yaml`).

Trigger’da “Cloud Build configuration file” olarak bu path’ler seçilir; **Configuration type:** “Cloud Build configuration file (YAML or JSON)”.

---

## 5. Özet akış

1. **Local:** `feat/xxx` branch’inde geliştir.
2. **Push to feat:** `git push origin feat/xxx` → Backend-preview + Frontend-preview trigger’ları çalışır → `{projectname}-api-preview` ve `{projectname}-web-preview` güncellenir. **Canlı (main) etkilenmez.**
3. **Preview URL’leri:** Cloud Run’dan `{projectname}-web-preview` ve `{projectname}-api-preview` URL’lerini açarak test et.
4. **Canlıya geçiş:** PR’ı merge et → `main` güncellenir → Prod trigger’ları çalışır → `{projectname}-api` ve `{projectname}-web` güncellenir.

---

## 6. İlk kurulum sırası (preview için)

1. **Backend-preview trigger’ını** oluştur (branch `^feat/.*`, config `backend/cloudbuild.yaml`, `_SERVICE={projectname}-api-preview`, `_REGION=europe-west1`).
2. **Feat branch’e push et** veya trigger’ı manuel çalıştır → `{projectname}-api-preview` deploy olur.
3. Cloud Run’dan **{projectname}-api-preview** URL’ini kopyala.
4. **Frontend-preview trigger’ını** oluştur; Advanced → Substitution variables’a `_SERVICE={projectname}-web-preview`, `_REGION=europe-west1` ve **`_NEXT_PUBLIC_API_URL`** / **`_NEXT_PUBLIC_SOCKET_URL`** = az önce kopyaladığın preview backend URL’i (biri `/api` ile, biri sadece base URL).
5. Frontend-preview’ı çalıştır (push veya manuel) → `{projectname}-web-preview` doğru API’ye bağlanır.

---

## 7. Kısa referans

| Ne zaman | Hangi trigger’lar | Nereye deploy |
|----------|-------------------|---------------|
| `feat/*` push | backend-preview, frontend-preview | {projectname}-api-preview, {projectname}-web-preview (izole preview) |
| `main` push/merge | backend-deploy (prod), frontend-deploy (prod) | {projectname}-api, {projectname}-web (canlı) |

- **Preview = izole test ortamı;** canlıyı etkilemez.
- **Canlı = sadece main** üzerinden güncellenir.

Projeye özel env değişkenleri ve adım adım deploy için ana **DEPLOYMENT.md** (ve varsa pipeline dokümanı) kullanılabilir.

---

## 8. Environment ve secret yönetimi (önerilen pattern)

**Genel kural:** Gizli olanlar (DB URL, API key, JWT secret) **koda ve cloudbuild.yaml’a yazılmaz**, ortamdan/Secret Manager’dan okunur.

### 8.1 Local (geliştirici makinesi)

- Backend: `{projectname}/backend/.env` (gitignore’da)
  - `DATABASE_URL=...`
  - `JWT_SECRET=...`
- Frontend: `{projectname}/frontend/.env.local`
  - `NEXT_PUBLIC_API_URL=http://localhost:5000/api`

Bu dosyalar **Git’e eklenmez**, sadece local içindir.

### 8.2 Prod (Cloud Run + Secret Manager)

1. **Secret oluştur (Secret Manager)**
   - Örn. `{projectname}-prod-DATABASE_URL`, `{projectname}-prod-JWT_SECRET`.
   - Değeri burada sakla (örnek DB URL: `mysql://user:pass@host:3306/db`).

2. **Cloud Run servisine bağla**
   - Cloud Run → `{projectname}-api` → *Edit & deploy new revision*.
   - **Variables & secrets** → **Add variable**:
     - Name: `DATABASE_URL`
     - Source: **Secret** → `{projectname}-prod-DATABASE_URL` → *latest*.
   - Benzer şekilde diğer secret’lar (`JWT_SECRET` vb.).

3. **Cloud Build tarafında sadece gizli olmayan config’ler**
   - `backend/cloudbuild.yaml` içindeki `--set-env-vars`:
     - Örn. `NODE_ENV=production,FRONTEND_URL=https://...`
   - **DATABASE_URL gibi secret’lar burada olmaz**, sadece Cloud Run + Secret Manager üzerinden gelir.

4. **Frontend için**
   - Gizli olmayan env’ler (`_NEXT_PUBLIC_API_URL`, `_NEXT_PUBLIC_SOCKET_URL`) → Cloud Build substitutions ile verilir.
   - Gizli şeyler mümkün olduğunca backend’e taşınır; gerekirse onlar da Secret Manager’dan okunur.

Bu pattern hem `{projectname}` gibi tek proje için hem de birden fazla proje için (her proje kendi Secret Manager secret’larını kullanarak) uygulanabilir.

---

## 9. Kafanda şöyle tut (kısa ok şeması)

**Backend akışı**

- Kod → Backend Docker imajı → `gcr.io/PROJE_ID/{projectname}-api:TAG` → Cloud Run (`{projectname}-api`) → Secret Manager’dan `DATABASE_URL` → `/api/...` endpoint’leri

**Frontend akışı**

- Kod → Frontend Docker imajı (build arg ile doğru API URL gömülü) → `gcr.io/PROJE_ID/{projectname}-web:TAG` → Cloud Run (`{projectname}-web`) → Kullanıcı tarayıcısı → `{projectname}-api`’ye istek

