import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.rag_engine import agentic_router, hybrid_search, get_page_image, generate_answer_with_vision, initialize_search_engines

def test_km1l():
    print("1. Motorları başlat")
    initialize_search_engines()
    
    q = "km1l nedir ?"
    chat_history = []
    
    # Router
    target_categories, search_query = agentic_router(q, chat_history)

    with open("test_km1l_output.txt", "w", encoding="utf-8") as f:
        f.write(f"Router Kategoriler: {target_categories} | Sorgu: {search_query}\n")
        
        # Arama
        results = hybrid_search(search_query, target_categories, n_results=8, apply_filter=True)
        if not results:
            results = hybrid_search(search_query, target_categories=None, n_results=8, apply_filter=False)
            
        images_to_send = []
        reference_text = ""
        
        if results:
            for item in results:
                source = item['meta'].get('source', 'Bilinmiyor')
                page = item['meta'].get('page', 0)
                f.write(f"BULUNAN: {source} (Sayfa: {page}) -> {item['type']}\n")
                reference_text += f"\n--- KAYNAK: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
                
                # Resimleri ekle
                if img := get_page_image(source, page):
                    images_to_send.append(img)
                    
        # Gemini ile Cevap Üretimi
        f.write("\nGemini Flash analiz ediyor...\n")
        answer = generate_answer_with_vision(q, images_to_send, reference_text, chat_history)
        f.write(f"\nGEMİNİ CEVABI:\n{answer}\n")

if __name__ == "__main__":
    test_km1l()
