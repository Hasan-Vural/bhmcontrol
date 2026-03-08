import time
from src.rag_engine import agentic_router, hybrid_search

def test_pipeline():
    print("="*50)
    print("RAG PIPELINE TEST BASLIYOR")
    print("="*50)
    
    # 1. Test edilecek standart bakım soruları
    test_queries = [
        "YV90 valfi nerede bulunuyor?",
        "Akümülatör modülünün çalışma basıncı nedir?",
        "Elektrik panosundaki sigorta yandı, ne yapmalıyım?"
    ]
    
    # 2. Döngüyle her soruyu test et
    for i, raw_query in enumerate(test_queries, 1):
        print(f"\n[{i}] Soru: '{raw_query}'")
        
        # Süre Ölçümü Başlar
        start_time = time.time()
        
        # A. Yönlendiriciyi (Router) Test Et
        categories, search_query = agentic_router(raw_query, chat_history=[])
        router_time = time.time() - start_time
        
        # B. Hibrit Aramayı Test Et
        results = hybrid_search(search_query, target_categories=categories, n_results=3, apply_filter=True)
        search_time = time.time() - (start_time + router_time)
        
        # Toplam Süre
        total_time = time.time() - start_time
        
        # Sonuçları Yazdır
        print(f"   Kategoriler: {categories} | Hedeflenen Soru: '{search_query}'")
        print(f"   Sureler -> Router: {router_time:.2f}sn | Arama: {search_time:.2f}sn | Toplam: {total_time:.2f}sn")
        
        if results:
            best_match = results[0]['meta']
            print(f"   En Iyi Eslesme: {best_match.get('source', 'Bilinmiyor')} (Sayfa {best_match.get('page', '?')})")
            print(f"   Skor Tipi: {results[0]['type']}")
        else:
            print("   Eslesme Bulunamadi!")

if __name__ == "__main__":
    # Chroma ve BM25 veritabanlarını yüklemek için import ediyoruz
    from src.rag_engine import initialize_search_engines
    initialize_search_engines()
    
    test_pipeline()
