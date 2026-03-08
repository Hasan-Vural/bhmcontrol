import requests
import json
import time

BASE_URL = "http://localhost:8002/api"

def run_test_scenario():
    print("=== ŞİRKET HAFIZASI (JSON API) TEST SENARYOSU ===\n")

    # 1. ADIM: SİSTEME YENİ BİR İŞ EMRİ (SAHA ÇÖZÜMÜ) GİR
    print("1. ADIM: Teknisyen sahadan yeni bir çözüm giriyor (POST /work-order/create)...")
    work_order_payload = {
        "hata_kodu": "1002",
        "title": "PH5000 Presi Aşırı Isınma ve YV90 Valf Arızası",
        "description": "Orijinal kılavuz 40 derece der ama sahada YV90 valfi takılı kaldığında pres beyninden 400 derece uyarısı veriyordu. Valf sökülüp X contası yenilendi ve 55 bara manuel kalibre edildi. Sorun 5 dakikada çözüldü.",
        "isg_checks": "[X] LOTO Kilit uygulandı [X] Basınç tahliye edildi",
        "ekipman": "Hidrolik Ünitesi",
        "author": "Kıdemli Usta Berke"
    }
    
    response = requests.post(f"{BASE_URL}/work-order/create", json=work_order_payload)
    order_data = response.json()
    print(f"[OK] Yanıt: {order_data}")
    order_id = order_data.get("id")
    time.sleep(1)

    # 2. ADIM: BEKLEYEN ONAYLARI LİSTELE
    print("\n2. ADIM: Yönetici panele girip bekleyenleri görüntülüyor (GET /work-order/pending)...")
    response = requests.get(f"{BASE_URL}/work-order/pending")
    pending_orders = response.json()
    print(f"[OK] Bulunan bekleyen iş emri sayısı: {len(pending_orders)}")
    for order in pending_orders:
        print(f"   - ID: {order['id']} | Başlık: {order['title']} | Ekleyen: {order['author']}")
    time.sleep(1)

    # 3. ADIM: İŞ EMRİNİ ONAYLA (CHROMA DB'YE EKLENSİN)
    print(f"\n3. ADIM: Yönetici {order_id} ID'li çözümü ONAYLIYOR (POST /work-order/approve/ID)...")
    print("   (Bu aşamada metin vektöre çevrilip yapay zekanın beynine gömülüyor)")
    response = requests.post(f"{BASE_URL}/work-order/approve/{order_id}")
    print(f"[OK] Yanıt: {response.json()}")
    time.sleep(2) # Give ChromaDB a second to settle

    # 4. ADIM: GEMINI'YE SORUYU SOR (JSON FORMATINDA)
    print("\n4. ADIM: Başka bir teknisyen siteden 'YV90 arızası' diye soruyor (POST /chat)...")
    chat_payload = {
        "query": "PH5000 presinde YV90 valfi arızası ve aşırı ısınma var ne yapmalıyım?",
        "chat_history": []
    }
    
    print("   [Model] hem PDF'leri hem de yeni Şirket Hafızasını tarayıp birleştiriyor (Lütfen bekleyin)...\n")
    response = requests.post(f"{BASE_URL}/chat", json=chat_payload)
    chat_result = response.json()

    print("=== FRONTEND (WEB SİTESİ) İÇİN DÖNEN JSON CEVABI ===")
    print(json.dumps(chat_result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    run_test_scenario()
