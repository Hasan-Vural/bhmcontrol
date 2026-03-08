import os
import sys

# Proje dizinini (src) sys.path'e eklentileyerek modüllerin doğru yüklenmesini sağlayalım
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.rag_engine import agentic_router, hybrid_search, get_page_image, generate_answer_with_vision, initialize_search_engines

# Test soruları (Llama'da sorun çıkaran 5 soru)
questions = [
    "AJ100 (PNOZ-MOP) güvenlik modülü şemasına (Sayfa 9) göre; T0 ve T1 çıkışlarından başlayan güvenlik zincirinde, SQ11A ve SQ11C sensörlerinden geçen sinyaller (kablo 084 ve 085), AJ100 modülünün hangi INPUT (Giriş) numaralarına (Örn: 14, 15, 112 vb.) geri dönmektedir ?",
    "Elektrik projesinin 48. sayfasında yer alan Klima/Soğutucu (Condizionatore) şemasına göre; eğer sistemde 'TX050' model termostat takılıysa 'Par. AL' parametresi hangi değere ayarlanmalıdır? Ayrıca bu soğutma sistemi ortam sıcaklığı kaç dereceyi aştığında devreye girmektedir?",
    "Yv90 nedir ?",
    "Sistemdeki tüm akümülatörlerin toplam hacmi (Litre bazında) nedir ve her birinin çalışma basıncı aynı mıdır?",
    "PH5000LB presi için tavsiye edilen hidrolik yağ viskozite değerleri sıcaklığa göre nasıl değişmektedir?"
]

def run_tests():
    print("\n" + "="*80)
    print("🚀 CLOUD (GEMİNİ FLASH) KARŞILAŞTIRMA TESTİ BAŞLIYOR...")
    print("Mentor sunumu için kararlı ve döngüsüz (loopsuz) test ortamı.")
    print("="*80 + "\n")
    
    # 1. Motorları başlat
    initialize_search_engines()
    
    chat_history = []
    
    with open("gemini_test_results.txt", "w", encoding="utf-8") as f:
        f.write("=== GEMİNİ FLASH 1.5 TEST SONUÇLARI ===\n\n")
        
        for i, q in enumerate(questions, 1):
            print(f"\n[{i}/5] SORU: {q}")
            f.write(f"--- SORU {i} ---\n{q}\n\n")
            
            # Router
            target_categories, search_query = agentic_router(q, chat_history)
            
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
                    reference_text += f"\n--- KAYNAK: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
                    # İlk 2 resmi alıyoruz
                    if len(images_to_send) < 2:
                        if img := get_page_image(source, page): 
                            images_to_send.append(img)
                        
            # Gemini ile Cevap Üretimi
            print("🤖 Gemini Flash analiz ediyor...")
            answer = generate_answer_with_vision(q, images_to_send, reference_text, chat_history)
            
            # Sonucu yazdır
            print(f"💡 GEMİNİ CEVABI:\n{answer}\n")
            f.write(f"💡 GEMİNİ YANITI:\n{answer}\n")
            f.write("="*80 + "\n\n")
            
            # Hafıza Güncellemesi
            chat_history.append({"role": "Mühendis", "text": q})
            chat_history.append({"role": "AI Asistan", "text": answer})
            if len(chat_history) > 6: chat_history = chat_history[-6:]
            
    print("\n✅ Test tamamlandı. Sonuçlar 'gemini_test_results.txt' dosyasına kaydedildi.")

if __name__ == "__main__":
    run_tests()
