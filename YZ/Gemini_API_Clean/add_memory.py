import requests

BASE_URL = "http://localhost:8002/api"

print("=" * 60)
print("📝 ŞİRKET HAFIZASINA YENİ SAHA ÇÖZÜMÜ GİRİŞİ")
print("=" * 60)

# 1. Kullanıcıdan verileri alalım
title = input("Arıza Semptomu (Örn: Motor 102 Arızası): ")
hata_kodu = input("İlintili Hata Kodu veya Etiket (Örn: E101 veya #PRESS-DURMA): ")
ekipman = input("İlgili Ekipman (Bilinmiyorsa boş bırakın): ")
description = input("Uyguladığınız Çözüm Adımları: ")
isg = input("İSG Kuralları (Örn: Ana şalter kapatıldı): ")
author = input("Teknisyen Adı: ")

print("\n📡 Sunucuya gönderiliyor (Beklemeye Alınıyor)...")

# 2. İş Emrini Oluştur (Teknisyen Gözü)
try:
    create_req = requests.post(f"{BASE_URL}/work-order/create", json={
        "hata_kodu": hata_kodu,
        "title": title,
        "description": description,
        "isg_checks": isg,
        "ekipman": ekipman if ekipman else "Bilinmiyor",
        "author": author
    })
    
    if create_req.status_code == 200:
        order_data = create_req.json()
        order_id = order_data["id"]
        print(f"✅ İş emri başarıyla oluşturuldu! (ID: {order_id})")
        
        # 3. Yönetici Onayı (Simülasyon)
        print("\n👨‍💼 YÖNETİCİ ONAYI SİMÜLASYONU")
        onay = input(f"{order_id} numaralı iş emrini onaylayıp yapay zekaya öğretelim mi? (e/h): ")
        
        if onay.lower() == 'e':
            print("⏳ Vektör Uzayına (ChromaDB) gömülüyor...")
            approve_req = requests.post(f"{BASE_URL}/work-order/approve/{order_id}")
            
            if approve_req.status_code == 200:
                print(f"🧠 HARİKA! Yapay Zeka artık bu çözümü biliyor.")
                print("Hemen 'ask_api.py' üzerinden az önce yazdığınız başlıkla ilgili bir soru sorarak test edebilirsiniz!")
            else:
                print(f"❌ Onay Hatası: {approve_req.text}")
        else:
            print("İşlem iptal edildi. Çözüm sadece veritabanında 'bekliyor' durumunda kaldı.")
            
    else:
        print(f"❌ Oluşturma Hatası: {create_req.text}")
        
except Exception as e:
    print(f"❌ Bağlantı hatası: {e}\n(FastAPI sunucusunun localhost:8002 portunda çalıştığına emin olun!)")
