import streamlit as st
import os
import sys

# Ensure src is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.rag_engine import agentic_router, hybrid_search, get_page_image, generate_answer_with_vision, initialize_search_engines

# Set page config
st.set_page_config(page_title="Engenius AI (Gemini)", page_icon="☁️", layout="wide")

st.title("☁️ Engenius Mühendis AI -(Gemini Flash)")

if "engines_initialized" not in st.session_state:
    with st.spinner("Arama Motorları Başlatılıyor..."):
        initialize_search_engines()
        st.session_state.engines_initialized = True
        st.session_state.chat_history = []

# Display chat messages from history
for message in st.session_state.chat_history:
    with st.chat_message("user" if message["role"] == "Mühendis" else "assistant"):
        st.markdown(message["text"])

# React to user input
if prompt := st.chat_input("Sorunuzu buraya yazın..."):
    # Display user message
    st.chat_message("user").markdown(prompt)
    
    with st.spinner("Dokümanlar taranıyor..."):
        target_categories, search_query = agentic_router(prompt, st.session_state.chat_history)
        
        st.info(f"🔍 **Router Kategoriler**: {', '.join(target_categories)} | **Sorgu**: {search_query}")
        
        results = hybrid_search(search_query, target_categories, n_results=8, apply_filter=True)
        
        if not results:
            results = hybrid_search(search_query, target_categories=None, n_results=8, apply_filter=False)
            
        if not results:
            st.error("❌ Tüm veritabanı tarandı ancak ilgili doküman bulunamadı.")
            st.stop()
            
        images_to_send = []
        reference_text = ""
        
        with st.expander("📚 Bulunan Referans Sayfalar", expanded=False):
            cols = st.columns(3)
            img_count = 0
            for item in results:
                source = item['meta'].get('source', 'Bilinmiyor')
                page = item['meta'].get('page', 0)
                st.markdown(f"- **[{item['meta'].get('kategori', 'Genel')}]** {source} (Sayfa: {page}) -> {item['type']}")
                reference_text += f"\n--- KAYNAK: {source} (Sayfa {page}) ---\n{item['parent_text']}\n"
                
                if img := get_page_image(source, page):
                    images_to_send.append(img)
                    with cols[img_count % 3]:
                        st.image(img, caption=f"{source} - S.{page}", use_container_width=True)
                    img_count += 1

        with st.spinner("🤖 Gemini Flash yanıt üretiyor..."):
            answer = generate_answer_with_vision(prompt, images_to_send, reference_text, st.session_state.chat_history)
            
            with st.chat_message("assistant"):
                st.markdown(answer)

            # Update chat history
            st.session_state.chat_history.append({"role": "Mühendis", "text": prompt})
            st.session_state.chat_history.append({"role": "AI Asistan", "text": answer})
            if len(st.session_state.chat_history) > 6:
                st.session_state.chat_history = st.session_state.chat_history[-6:]
