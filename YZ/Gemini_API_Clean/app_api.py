"""
RAG AI Servisi - HTTP API (Web entegrasyonu)
Engenius WebBackend'in POST /ask ile çağırdığı FastAPI uygulaması.
"""
import os
import sys
import uuid
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

# Proje kökünü path'e ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.rag_engine import ask_ai_with_context

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RAG_PORT = int(os.getenv("RAG_PORT", "8000"))
CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_STR.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Request/Response modelleri
# ---------------------------------------------------------------------------
class AskBody(BaseModel):
    question: str = Field(..., min_length=1, description="Kullanıcı sorusu")
    mode: str = Field(default="detailed", description="short | detailed | work_order")
    machineId: Optional[str] = None
    machineCode: Optional[str] = None
    userId: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = Field(default=None, description="İleride kullanım için; şimdilik boş")
    source: Optional[str] = Field(default=None, description="Belge adı (doc-chat kaynak kısıtı)")
    pages: Optional[List[int]] = Field(default=None, description="Sayfa listesi (doc-chat sayfa kısıtı)")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Engenius RAG AI API",
    description="Chroma + Gemini RAG servisi; WebBackend POST /ask ile çağırır.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

VALID_MODES = {"short", "detailed", "work_order"}


@app.get("/health")
def health():
    """Sağlık kontrolü; WebBackend veya yük dengeleyici için."""
    return {"status": "ok", "service": "rag-ai"}


@app.post("/ask")
def ask(body: AskBody):
    """
    RAG motoru ile soru cevapla.
    Dönen JSON: mode, error_code, short_answer, detailed_answer, work_order_suggestion, attachments.
    """
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question zorunludur ve boş olamaz.")

    mode = (body.mode or "detailed").lower()
    if mode not in VALID_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz mode. Geçerli değerler: {', '.join(sorted(VALID_MODES))}",
        )

    chat_history = body.chat_history if body.chat_history is not None else []
    source = (body.source or "").strip() or None
    pages = body.pages if body.pages else None

    try:
        result = ask_ai_with_context(question, chat_history, mode=mode, source=source, pages=pages)
    except Exception as e:
        # Log ve 500 dön
        import logging
        logging.getLogger("uvicorn.error").exception("RAG motoru hatası: %s", e)
        raise HTTPException(
            status_code=500,
            detail="RAG motoru hatası. Lütfen tekrar deneyin veya yetkili ile görüşün.",
        ) from e

    # WebBackend'in beklediği formatta; id yoksa burada üret (backend'de de fallback var)
    result.setdefault("id", str(uuid.uuid4()))
    return result
