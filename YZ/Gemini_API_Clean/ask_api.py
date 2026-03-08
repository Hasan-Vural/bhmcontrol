import requests
import json

BASE_URL = "http://localhost:8002/api"
current_history = []

print("=" * 60)
print("🤖 ENGENIUS MÜHENDİS AI - İNTERAKTİF API TESTİ")
print("=" * 60)
print("Çıkmak için 'q' veya 'quit' yazın.\n")

while True:
    user_input = input("Soru: ")
    if user_input.lower() in ['q', 'quit', 'exit']:
        print("Çıkış yapılıyor...")
        break
        
    if not user_input.strip():
        continue
        
    print("\n🔍 Analiz ediliyor (Lütfen Bekleyin)...\n")
    
    # Send the request to the local FastAPI server
    try:
        response = requests.post(f"{BASE_URL}/chat", json={
            "query": user_input,
            "chat_history": current_history
        })
        
        if response.status_code == 200:
            data = response.json()
            
            # Print the AI's direct answer beautifully
            print(f"🤖 AI YANITI:\n{data['answer']}\n")
            print(f"📑 Bulunan Kaynaklar: {len(data['sources'])}")
            print("-" * 50)
            
            # Save to history for context/pronoun resolution!
            current_history.append({"role": "Mühendis", "text": user_input})
            current_history.append({"role": "AI Asistan", "text": data["answer"]})
            
            # Keep only the last 6 messages to not overwhelm the context window
            if len(current_history) > 6:
                current_history = current_history[-6:]
                
        else:
            print(f"❌ API Hatası: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Bağlantı hatası: {e}\n(FastAPI sunucusunun localhost:8002 portunda çalıştığına emin olun!)")
