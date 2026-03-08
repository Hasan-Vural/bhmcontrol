from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import os
import sys

# Ensure src is in path to import siblings
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import get_db, WorkOrder, Base, engine
from src.rag_engine import initialize_search_engines, agentic_router, hybrid_search, generate_answer_with_vision, get_page_image, embedding_model, VECTOR_DB_PATH
import chromadb
from datetime import datetime

app = FastAPI(title="Engenius Company Memory API", description="AI Backend for RAG and Field Solutions")

# Allow frontend to access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to load RAG engines
@app.on_event("startup")
def startup_event():
    initialize_search_engines()

# Pydantic Models for Validation
class WorkOrderCreate(BaseModel):
    title: str
    description: str
    isg_checks: str
    author: Optional[str] = "Anonim Teknisyen"

class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[dict]] = []

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    """
    RAG araması yapar. Hem standart PDF'leri hem de 'Saha Çözümleri'ni tarar,
    Gemini ile tek potada eritir. JSON olarak döner.
    """
    try:
        categories, optimized_query = agentic_router(request.query, request.chat_history)
        
        # 1. Aramayı yap
        results = hybrid_search(optimized_query, categories, n_results=6)
        if not results:
            results = hybrid_search(optimized_query, None, n_results=6)
            
        if not results:
            return {"answer": "Üzgünüm, ne orijinal dökümanlarda ne de şirket hafızasında bu konuyla ilgili bilgi bulamadım.", "sources": []}

        # 2. Kaynakları ikiye ayır (Orijinal Belge vs Saha Çözümü)
        isg_context = ""
        pdf_context = ""
        saha_context = ""
        source_list = []
        images = []
        
        for item in results:
            cat = item['meta'].get('kategori', 'Genel')
            source = item['meta'].get('source', '')
            page = item['meta'].get('page', '')
            
            source_list.append({"kategori": cat, "dosya": source, "sayfa": page})
            
            # Eğer ChromaDB'den gelen bir saha çözümü ise
            if cat == "Saha Çözümü":
                saha_context += f"--- SAHA TECRÜBESİ: {source} ---\n{item['parent_text']}\n"
            else:
                pdf_context += f"--- RESMİ BELGE: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
                # Görsel ekleme
                if len(images) < 2:  # Optimize for speed
                    img = get_page_image(source, page)
                    if img: images.append(img)
                    
        # 3. İki Context'i de birleştirip modele gönder
        final_references = f"RESMİ DOKÜMANLAR:\n{pdf_context}\n\nŞİRKET HAFIZASI (SAHA ÇÖZÜMLERİ):\n{saha_context}"
        
        answer = generate_answer_with_vision(request.query, images, final_references, request.chat_history)
        
        return {
            "answer": answer,
            "sources": source_list,
            "has_images": len(images) > 0,
            "router_categories": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/work-order/create")
def create_work_order(order: WorkOrderCreate, db: Session = Depends(get_db)):
    """ Sahadan yeni bir iş emri / çözüm girer. Onay bekler duruma geçer. """
    db_order = WorkOrder(
        title=order.title,
        description=order.description,
        isg_checks=order.isg_checks,
        author=order.author,
        status="pending"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return {"message": "Saha çözümü oluşturuldu, yönetici onayı bekliyor.", "id": db_order.id}

@app.get("/api/work-order/pending")
def get_pending_orders(db: Session = Depends(get_db)):
    """ Yöneticiler için bekleyen çözümleri listeler. """
    orders = db.query(WorkOrder).filter(WorkOrder.status == "pending").all()
    return orders

@app.post("/api/work-order/approve/{order_id}")
def approve_work_order(order_id: int, db: Session = Depends(get_db)):
    """ 
    Yönetici onayı verir. 
    1. Veritabanında status 'approved' yapılır.
    2. Çözüm Metni Vektör Veritabanına (ChromaDB) gömülür (Embed).
    """
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Saha Çözümü bulunamadı.")
        
    if order.status == "approved":
        return {"message": "Bu kayıt zaten onaylanmış."}
        
    order.status = "approved"
    db.commit()
    
    # --- CHROMA DB ENTEGRASYONU ---
    try:
        # Prepare text for AI understanding
        embedded_text = f"ARIZA: {order.title}\nÇÖZÜM: {order.description}\nİSG KONTROLLERİ: {order.isg_checks}\nMÜDAHALE EDEN: {order.author}"
        
        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection(name="bakim_dokumanlari")
        
        # Generate an absolute unique ID
        unique_vector_id = f"saha_cozumu_{order.id}"
        
        # Modeli çek ve vektöre çevir
        from src.rag_engine import embedding_model
        vector = embedding_model.encode([embedded_text]).tolist()
        
        # Veritabanına PDF gibi enjekte et
        collection.add(
            embeddings=vector,
            documents=[embedded_text],
            metadatas=[{
                "source": f"Şirket Hafızası: #{order.id} {order.title}",
                "page": 1,
                "kategori": "Saha Çözümü",
                "parent_text": embedded_text
            }],
            ids=[unique_vector_id]
        )
        # Note: In a complete production scenario, we should also manually update the BM25 corpus 
        # or have the RAG engine reload it. For simple demo, vector search will catch it.
        
    except Exception as e:
        # Revert status if DB fails
        order.status = "pending"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Vektör gömme hatası: {str(e)}")

    return {"message": f"'{order.title}' başarıyla onaylandı ve Kurumsal Hafızaya işlendi!"}
