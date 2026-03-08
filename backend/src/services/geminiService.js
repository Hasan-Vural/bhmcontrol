import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// GEMINI_API_KEY zorunlu olmaktan çıkarıldı: yoksa servis nazikçe hata dönecek,
// böylece backend diğer RAG entegrasyonlarıyla (FastAPI) çalışmaya devam edebilir.
let model = null;
if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  // Model adı: gemini-flash-lite-latest (Google AI Studio'da seçtiğin model)
  model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
} else {
  console.warn(
    '[geminiService] GEMINI_API_KEY tanımlı değil. /docs/ask endpointi sadece bilgilendirici hata döndürecek.',
  );
}

// Doküman klasörleri - önce Pres Dokümanları klasörünü kontrol et, yoksa server/docs'u kullan
const PRES_DOCS_DIR = path.join(__dirname, '../../../docs/instructions/Pres Dokümanları');
const FALLBACK_DOCS_DIR = path.join(__dirname, '../../docs');

/**
 * Hangi doküman klasörünü kullanacağımızı belirler
 */
async function getDocsDirectory() {
  try {
    const stats = await fs.stat(PRES_DOCS_DIR);
    if (stats.isDirectory()) {
      return PRES_DOCS_DIR;
    }
  } catch (error) {
    // Klasör yoksa fallback kullan
  }
  return FALLBACK_DOCS_DIR;
}

/**
 * Dokümanları klasörden okuyup metin içeriklerini döndürür
 */
async function readDocuments() {
  const DOCS_DIR = await getDocsDirectory();
  const files = await fs.readdir(DOCS_DIR);
  const documents = [];

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const stats = await fs.stat(filePath);
    
    if (!stats.isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    let content = '';

    try {
      if (ext === '.pdf') {
        const buffer = await fs.readFile(filePath);
        const data = await pdfParse(buffer);
        content = data.text;
      } else if (ext === '.docx' || ext === '.doc') {
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else if (ext === '.txt' || ext === '.md') {
        content = await fs.readFile(filePath, 'utf-8');
      } else {
        console.warn(`Desteklenmeyen dosya formatı: ${file}`);
        continue;
      }

      if (content.trim()) {
        documents.push({
          filename: file,
          content: content.trim(),
        });
      }
    } catch (error) {
      console.error(`Dosya okuma hatası (${file}):`, error.message);
    }
  }

  return documents;
}

/**
 * Kullanıcı sorusunu dokümanlara göre cevaplar
 */
export async function askQuestion(userQuestion) {
  // API anahtarı yoksa, erken ve kontrollü dönüş yap.
  if (!model) {
    return {
      answer:
        'Gemini tabanlı doküman soru-cevap servisi için GEMINI_API_KEY tanımlı değil. Lütfen sistem yöneticisiyle iletişime geçin.',
      sources: [],
      confidence: 'error',
    };
  }

  try {
    // Dokümanları oku
    const documents = await readDocuments();

    if (documents.length === 0) {
      const docsDir = await getDocsDirectory();
      return {
        answer: `Henüz hiç dokümantasyon yüklenmemiş. Lütfen dokümanları şu klasöre ekleyin: ${docsDir}`,
        sources: [],
        confidence: 'low',
      };
    }

    // Doküman içeriklerini birleştir (context olarak)
    // Token limiti için dokümanları optimize et (her doküman max 5000 karakter)
    const MAX_DOC_LENGTH = 5000;
    const context = documents
      .map((doc) => {
        const content = doc.content.length > MAX_DOC_LENGTH 
          ? doc.content.substring(0, MAX_DOC_LENGTH) + '...'
          : doc.content;
        return `[${doc.filename}]\n${content}`;
      })
      .join('\n\n---\n\n');

    // Gemini'ye gönderilecek prompt
    const prompt = `Sen bir bakım ve teknik destek asistanısın. Aşağıdaki teknik dokümantasyonları kullanarak kullanıcının sorusunu cevapla.

ÖNEMLİ KURALLAR:
1. Cevabını SADECE aşağıdaki dokümantasyonlardaki bilgilere dayanarak ver.
2. Eğer sorunun cevabı dokümantasyonlarda YOKSA, kesinlikle kendi bilginle cevap verme.
3. Dokümantasyonda olmayan bir bilgi için şunu söyle: "Bu konuda elimdeki dokümantasyonlarda bilgi bulunmuyor. Lütfen yetkili bir bakım sorumlusu ile görüşün."
4. Genel bilgi vermeye çalışma, sadece dokümantasyondaki spesifik bilgileri kullan.
5. Cevabını Türkçe ver.
6. Eğer dokümantasyonda bilgi varsa, hangi dokümandan geldiğini belirt (dosya adı).

DOKÜMANTASYONLAR:
${context}

KULLANICI SORUSU: ${userQuestion}

CEVAP:`;

    // Gemini'ye sor (retry mekanizması ile)
    let result;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break; // Başarılı, döngüden çık
      } catch (error) {
        // 429 hatası (rate limit) için retry yap
        if (error.status === 429 && retries < maxRetries - 1) {
          const retryDelay = error.errorDetails?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay || '5s';
          const delaySeconds = parseInt(retryDelay.replace('s', '')) || 5;
          console.log(`Rate limit hatası, ${delaySeconds} saniye bekleniyor... (Deneme ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          retries++;
          continue;
        }
        throw error; // Diğer hatalar için fırlat
      }
    }
    
    const response = await result.response;
    const answer = response.text();

    // Güven seviyesini tahmin et (basit bir kontrol)
    const hasNoInfoPhrase = answer.toLowerCase().includes('dokümantasyonlarda bilgi bulunmuyor') || 
                            answer.toLowerCase().includes('yetkili bir bakım sorumlusu');
    const confidence = hasNoInfoPhrase ? 'low' : 'high';

    // Kullanılan kaynakları belirle (basit bir eşleştirme)
    const usedSources = documents
      .filter((doc) => {
        // Soru ile doküman içeriği arasında basit bir eşleşme kontrolü
        const questionWords = userQuestion.toLowerCase().split(/\s+/);
        const docContent = doc.content.toLowerCase();
        return questionWords.some((word) => word.length > 3 && docContent.includes(word));
      })
      .map((doc) => doc.filename);

    return {
      answer,
      sources: usedSources.length > 0 ? usedSources : documents.map((d) => d.filename),
      confidence,
      documentCount: documents.length,
    };
  } catch (error) {
    console.error('Gemini API hatası:', error);
    
    // Rate limit hatası için özel mesaj
    if (error.status === 429) {
      return {
        answer: 'Ücretsiz kullanım limitine ulaşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin. Alternatif olarak yetkili bir bakım sorumlusu ile görüşebilirsiniz.',
        sources: [],
        confidence: 'error',
        error: 'Rate limit exceeded',
      };
    }
    
    return {
      answer: `Bir hata oluştu: ${error.message}. Lütfen tekrar deneyin veya yetkili bir bakım sorumlusu ile görüşün.`,
      sources: [],
      confidence: 'error',
      error: error.message,
    };
  }
}

/**
 * Doküman sayısını ve listesini döndürür
 */
export async function getDocumentInfo() {
  try {
    const documents = await readDocuments();
    return {
      count: documents.length,
      files: documents.map((d) => d.filename),
    };
  } catch (error) {
    console.error('Doküman okuma hatası:', error);
    return {
      count: 0,
      files: [],
      error: error.message,
    };
  }
}
