# Cloud Build 2nd Gen - GitHub Trigger Kurulumu

## Adım 1: GitHub Yetkilendirmesi (Yapılacak)

Bağlantı oluşturuldu ancak **PENDING_USER_OAUTH**. Şu adımları tamamlayın:

1. **Bu linke gidin (Cloud Build GitHub App yetkilendirmesi):**
   https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fconsole.cloud.google.com%2Fm%2Fgcb%2Fgithub%2Flocations%2Feurope-west1%2Foauth_v2%3Fconnection_name%3Dprojects%252F1086139931169%252Flocations%252Feurope-west1%252Fconnections%252Fbhm-github

2. **GitHub ile giriş yapın** ve Cloud Build'e erişim izni verin.

3. **Cloud Build GitHub App'i kurun:** https://github.com/apps/google-cloud-build  
   - Hesabınıza veya organizasyona kurun  
   - `bhmcontrol` (veya `Hasan-Vural/bhmcontrol`) reposuna erişim verin

4. **Kurulumu doğrulayın:**
   ```powershell
   gcloud builds connections describe bhm-github --region=europe-west1 --project=bhmcontrol
   ```
   `installationState: COMPLETE` olmalı.

---

## Adım 2: Repo Bağlama (OAuth sonrası)

GitHub yetkilendirmesi tamamlandıktan sonra:

```powershell
gcloud builds repositories create bhmcontrol ^
  --remote-uri="https://github.com/Hasan-Vural/bhmcontrol.git" ^
  --connection=bhm-github ^
  --region=europe-west1 ^
  --project=bhmcontrol
```

---

## Adım 3: Trigger'ları Oluşturma (2nd gen)

### Backend (main → prod)
```powershell
gcloud builds triggers create github ^
  --name="bhm-backend-deploy" ^
  --repository="projects/bhmcontrol/locations/europe-west1/connections/bhm-github/repositories/bhmcontrol" ^
  --branch-pattern="^main$" ^
  --build-config="backend/cloudbuild.yaml" ^
  --service-account="projects/bhmcontrol/serviceAccounts/bhm-admin@bhmcontrol.iam.gserviceaccount.com" ^
  --region=europe-west1 ^
  --project=bhmcontrol
```

### Frontend (main → prod)
```powershell
gcloud builds triggers create github ^
  --name="bhm-frontend-deploy" ^
  --repository="projects/bhmcontrol/locations/europe-west1/connections/bhm-github/repositories/bhmcontrol" ^
  --branch-pattern="^main$" ^
  --build-config="frontend/cloudbuild.yaml" ^
  --substitutions="_VITE_API_BASE_URL=https://bhm-api-vqntnqgivq-ew.a.run.app/api" ^
  --service-account="projects/bhmcontrol/serviceAccounts/bhm-admin@bhmcontrol.iam.gserviceaccount.com" ^
  --region=europe-west1 ^
  --project=bhmcontrol
```

---

## Özet

| Adım | Ne yapılır |
|------|------------|
| 1 | Linke gidip GitHub yetkilendirmesi + Cloud Build App kurulumu |
| 2 | `gcloud builds repositories create` (repo bağlama) |
| 3 | `gcloud builds triggers create repository-event` x2 (backend + frontend) |

Bağlantı adı: `bhm-github`  
Region: `europe-west1`  
Proje: `bhmcontrol`
