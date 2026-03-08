import os
from pathlib import Path
import torch

# Proje ana dizinini bulur (engenius python klasörü)
BASE_DIR = Path(__file__).resolve().parent.parent

# Klasör yolları
DATA_RAW = BASE_DIR / "data" / "raw"
DATA_PROCESSED = BASE_DIR / "data" / "processed"
VECTOR_DB_PATH = BASE_DIR / "data" / "vectordb"
MODEL_DIR = BASE_DIR / "models"

# Model Ayarları
# Başlangıç için küçük ve güçlü bir model (Mistral 7B)
MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.2"
CHUNK_SIZE = 512
CHUNK_OVERLAP = 50

# Cihaz Seçimi (Ekran kartın varsa cuda, yoksa cpu)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Klasörler yoksa oluştur (Garanti olsun)
DATA_RAW.mkdir(parents=True, exist_ok=True)
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)