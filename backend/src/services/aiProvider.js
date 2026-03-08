import { randomUUID } from 'crypto';

/**
 * Uygulama genelinde kullanılacak tek giriş noktası.
 * Şimdilik mock cevap üretir; ileride FastAPI RAG servisine bağlanmak için
 * buraya yeni bir provider (FastapiAiProvider) eklenebilir.
 *
 * @param {{ question: string; mode: 'short' | 'detailed' | 'work_order'; machineId?: string; machineCode?: string; userId?: string; documentContext?: { source: string; pages?: number[] | string } }} params
 * @returns {Promise<import('../types/ai.js').AiResponse>}
 */
export async function askAi(params) {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();

  if (provider === 'fastapi') {
    return fastapiAsk(params);
  }

  return mockAsk(params);
}

/**
 * Basit bir mock AI sağlayıcısı.
 * Belirli hata kodları ve anahtar kelimelere göre sabit ama gerçekçi JSON cevaplar üretir.
 *
 * @param {{ question: string; mode: 'short' | 'detailed' | 'work_order'; machineId?: string; machineCode?: string; userId?: string }} params
 * @returns {Promise<import('../types/ai.js').AiResponse>}
 */
async function mockAsk({ question, mode, machineId, machineCode }) {
  const cleanedQuestion = (question || '').trim();

  const detectedErrorCode = detectErrorCode(cleanedQuestion);

  if (detectedErrorCode === 'E202') {
    return buildE202Response({ mode, machineId, machineCode });
  }

  // Genel/kategori bazlı bir cevap üret
  return buildGenericResponse({ mode, machineId, machineCode, question: cleanedQuestion, errorCode: detectedErrorCode });
}

/**
 * Gelecekte FastAPI tabanlı gerçek RAG servisine bağlanmak için adapter.
 * Şu an için, ortam değişkenleri tanımlı değilse veya istek başarısız olursa
 * otomatik olarak mock sağlayıcıya düşer.
 */
async function fastapiAsk(params) {
  const baseUrl = process.env.FASTAPI_BASE_URL;
  const apiKey = process.env.FASTAPI_API_KEY;

  if (!baseUrl) {
    // Konfigürasyon eksikse mock'a geri dön
    return mockAsk(params);
  }

  const timeoutMs = Number(process.env.FASTAPI_TIMEOUT_MS) || 90_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL('/ask', baseUrl).toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        question: params.question,
        mode: params.mode,
        machineId: params.machineId,
        machineCode: params.machineCode,
        userId: params.userId,
        source: params.documentContext?.source,
        pages: params.documentContext?.pages,
        chat_history: Array.isArray(params.conversationHistory)
          ? params.conversationHistory.map((m) => ({ role: m.role, text: m.content || '' }))
          : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`FastAPI RAG error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Arkadaşının servisinin döndüğü JSON'u, uygulama içinde kullandığımız
    // AiResponse tipine map edecek basit bir adaptasyon katmanı.
    // attachments: RAG'dan { source, page, category, type } olarak gelir; olduğu gibi geçirilir (UI'da "Kaynak: X, Sayfa Y" gösterilebilir).
    return {
      id: data.id || randomUUID(),
      mode: data.mode || params.mode,
      error_code: data.error_code || null,
      short_answer: data.short_answer || '',
      detailed_answer: data.detailed_answer || null,
      work_order_suggestion: data.work_order_suggestion || null,
      attachments: data.attachments || [],
    };
  } catch (error) {
    console.error('FastAPI RAG çağrısı başarısız, mock sağlayıcıya düşülüyor:', error);
    return mockAsk(params);
  } finally {
    clearTimeout(timeoutId);
  }
}


function detectErrorCode(text) {
  if (!text) return null;
  const match = text.toUpperCase().match(/\b[A-Z]{1,2}\d{3,4}\b/);
  return match ? match[0] : null;
}

/**
 * Kullanıcının paylaştığı E202 örneğine yakın, güvenli ve yapılandırılmış bir mock cevap.
 */
function buildE202Response({ mode, machineId, machineCode }) {
  const base = {
    id: randomUUID(),
    mode,
    error_code: 'E202',
    short_answer:
      'E202 hatası genellikle sensörün yüzeyindeki kir, yağ veya karo kalıntılarından kaynaklanan geçici bir okuma problemidir. Sensör temizliği sonrası genelde geçici olarak düzelir.',
    detailed_answer: null,
    work_order_suggestion: null,
    attachments: [],
  };

  const detailed = `⚠️ *İSG UYARISI:* Sensör temizliği veya herhangi bir mekanik/elektriksel müdahale öncesinde makineyi emniyetli duruşa alın, enerji izolasyonunu (LOTO) uygulayın. Selülozik tiner son derece yanıcı ve uçucu bir maddedir; uygulama sırasında açık alev, kıvılcım ve sıcak yüzeylerden uzak durun, uygun koruyucu eldiven ve maske kullanın.

Sahada bu tip hatalar çoğu zaman üretimi tamamen durdurur, bu yüzden hızlı ama kontrollü hareket etmek önemlidir. E202 hatası için tipik kök neden ve çözüm adımları şöyledir:

1. **Görsel kontrol**
   - İlgili sensörün kablo bağlantılarını, konnektörlerini ve montajını kontrol edin.
   - Sensör ucunda birikmiş yağ, toz, karo kalıntısı veya pas olup olmadığını inceleyin.

2. **Sensör yüzeyinin temizlenmesi**
   - Makine emniyetteyken sensörün erişim bölgesini açın.
   - Uygun KKD ile, sensör ucunu az miktarda selülozik tinerle silerek yüzeyi kirden arındırın.
   - Tamamen kurumasını bekleyin ve tiner kalıntısı bırakmadığınızdan emin olun.

3. **Tekrar devreye alma ve test**
   - Makineyi tekrar devreye alın, ilgili çevrimde E202 hatasının tekrar edip etmediğini gözleyin.
   - Hata periyodik olarak geri geliyorsa, sensörün ortam koşullarına (sıcaklık, nem, kirletici) uygunluğu ve kablo güzergahı yeniden değerlendirilmelidir.

4. **Önleyici bakım önerisi**
   - Bu hata daha önce de sık tekrarlandıysa, sensör için periyodik temizlik ve kontrol planına madde ekleyin.
   - Gerekirse sensör tipi, koruma sınıfı veya montaj pozisyonu üretici önerilerine göre revize edilmelidir.

[SAHA TECRÜBESİ] Notlarımıza göre, sensör ucunu selülozik tinerle temizlemek çoğu durumda hatayı *geçici* olarak çözer; kök sebep olarak sensör yüzeyinde biriken kir ve kalıntılar düşünülmelidir.`;

  const workOrder = {
    title: 'E202 sensör temizliği ve kontrolü',
    machine_id: machineId || null,
    machine_code: machineCode || null,
    estimated_duration_min: 45,
    priority: 'HIGH',
    steps: [
      'Makineyi emniyetli duruşa al ve enerji izolasyonunu (LOTO) uygula.',
      'İlgili sensöre erişim için gerekli muhafazaları aç, mekanik emniyeti kontrol et.',
      'Sensör ucunu uygun KKD ile, az miktarda selülozik tiner kullanarak temizle.',
      'Sensörün tamamen kurumasını bekle, kablo ve konnektörleri gevşeklik açısından kontrol et.',
      'Makineyi yeniden devreye al ve birkaç çevrim boyunca E202 hatasının tekrar edip etmediğini gözlemle.',
    ],
    materials: ['Selülozik tiner', 'Temiz, tüy bırakmayan bez', 'Koruyucu eldiven', 'Maske'],
  };

  if (mode === 'short') {
    return {
      ...base,
      detailed_answer: null,
      work_order_suggestion: null,
    };
  }

  if (mode === 'detailed') {
    return {
      ...base,
      detailed_answer: detailed,
      work_order_suggestion: null,
    };
  }

  // work_order modu
  return {
    ...base,
    detailed_answer: detailed,
    work_order_suggestion: workOrder,
  };
}

function buildGenericResponse({ mode, machineId, machineCode, question, errorCode }) {
  const base = {
    id: randomUUID(),
    mode,
    error_code: errorCode,
    short_answer:
      'Sorduğun arıza ile ilgili elimde detaylı bir AI entegrasyonu henüz yok, ancak tipik bakım akışına göre ilgili makinenin emniyetini alıp hata kodunun geçtiği bölgeyi sistematik olarak kontrol etmen gerekir.',
    detailed_answer: null,
    work_order_suggestion: null,
    attachments: [],
  };

  const genericDetailed = `⚠️ *İSG UYARISI:* Elektriksel veya basınçlı sistemlere müdahale etmeden önce mutlaka makineyi emniyetli duruşa alın, enerji izolasyonunu (LOTO) uygulayın ve sadece yetkili bakım personelinin müdahale etmesini sağlayın.

Bu cevap, gerçek RAG motoru devreye alınmadan önce kullanılan bir *mock* yanıtıdır. Amacı, bakım AI konsolunun akışını ve iş emri süreçlerini test etmenize yardımcı olmaktır.

Genel öneriler:
- Hata kodu veya arıza metni: \`${question || '—'}\`
- İlgili makine: \`${machineCode || machineId || 'bilinmiyor'}\`

1. **Durumu gözlemle**
   - Operatörden, hatanın ne zaman başladığı ve ne sıklıkla tekrar ettiği hakkında bilgi alın.
   - Makine panelinde ek uyarı veya alarm kodu olup olmadığını kontrol edin.

2. **İlgili bölgeyi incele**
   - Hata kodunun işaret ettiği bölgeyi (emniyet, hareket, hidrolik vb.) görsel ve temel elektriksel kontrollerle inceleyin.

3. **Gerekirse üst seviye AI/RAG desteği**
   - Gerçek RAG servisi devreye alındığında, bu adımda teknik dokümanlar ve saha tecrübeleri ile daha spesifik adımlar üretilecektir.`;

  const genericWorkOrder = {
    title: errorCode ? `${errorCode} arızası için genel kontrol` : 'Genel arıza incelemesi',
    machine_id: machineId || null,
    machine_code: machineCode || null,
    estimated_duration_min: 60,
    priority: 'MEDIUM',
    steps: [
      'Makineyi emniyetli duruşa al ve enerji izolasyonunu uygula.',
      'Operatörden arızanın başlangıcı, tekrarlama sıklığı ve üretime etkisi hakkında bilgi al.',
      'Panelde kayıtlı diğer hata veya uyarı kodlarını not al.',
      'Hata kodunun işaret ettiği bölgedeki kablo bağlantılarını, sensör/aktüatör montajını ve mekanik engelleri kontrol et.',
      'Gerekirse sonuçları üst seviye mühendislik ekibiyle paylaş ve kalıcı aksiyon planı çıkar.',
    ],
    materials: [],
  };

  if (mode === 'short') {
    return {
      ...base,
      detailed_answer: null,
      work_order_suggestion: null,
    };
  }

  if (mode === 'detailed') {
    return {
      ...base,
      detailed_answer: genericDetailed,
      work_order_suggestion: null,
    };
  }

  // work_order modu
  return {
    ...base,
    detailed_answer: genericDetailed,
    work_order_suggestion: genericWorkOrder,
  };
}

