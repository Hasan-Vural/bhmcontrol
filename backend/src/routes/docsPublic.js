import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { pdf } from 'pdf-to-img';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const docsPublicRouter = Router();

const DOCS_PUBLIC_DIR = path.join(__dirname, '../../docs-public');

/**
 * docs-public içindeki tüm dosyaları (rekürsif) listeler.
 * GET /api/docs-public/list -> { files: [ { name, relativePath } ] }
 */
docsPublicRouter.get('/list', async (req, res) => {
  try {
    const files = await listFilesRecursive(DOCS_PUBLIC_DIR, '');
    res.json({ files });
  } catch (err) {
    console.error('docs-public list error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function listFilesRecursive(dir, relativePrefix) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (const e of entries) {
    const rel = relativePrefix ? `${relativePrefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const sub = await listFilesRecursive(path.join(dir, e.name), rel);
      result.push(...sub);
    } else {
      result.push({ name: e.name, relativePath: rel });
    }
  }
  return result;
}

/** Türkçe stopwords - bunlar anahtar kelime olarak alınmaz */
const STOPWORDS = new Set(['ve', 'ile', 'için', 'bir', 'bu', 'da', 'de', 'gibi', 'olan', 'olarak', 'ne', 'nasıl', 'neden', 'hangi', 'sahip', 'var', 'yok', 'the', 'and', 'for', 'şirket', 'hafızası', 'saha', 'çözümü', 'çözüm']);

/**
 * Başlıktan anlamlı anahtar kelimeleri çıkarır (Şirket Hafızası, PH5000, YV90, valf, arıza vb.)
 */
function extractKeywords(text) {
  const normalized = text
    .replace(/\s*-\s*S\.\d+.*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[#:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));
  const keywords = new Set();
  for (const w of words) {
    const clean = w.replace(/[^\wğüşıöçĞÜŞİÖÇa-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length >= 2) keywords.add(clean);
  }
  return [...keywords];
}

/**
 * RAG'dan gelen "İlgili sayfalar" bazen tam dosya adı (ELEKTRİK PROJESİ.pdf) bazen uzun başlık
 * (Şirket Hafızası: #3 PH5000 YV90 Valf Arızası ve Isınma - S.1) olur.
 * 1) Tam eşleşme
 * 2) Başlık/dosya adı içerme
 * 3) Şirket Hafızası için: anahtar kelime skorlaması (PH5000, YV90, ELEKTRİK vb.)
 * 4) Son çare: valf/ısınma/elektrik konuları için ELEKTRİK PROJESİ veya ilk PDF
 */
function findBestFileMatch(requested, files) {
  const decoded = decodeURIComponent(requested).trim();
  const pdfFiles = files.filter((f) => /\.(pdf|PDF)$/.test(f.name));
  if (pdfFiles.length === 0) return null;

  const exact = pdfFiles.find((f) => f.name === decoded || f.name === requested);
  if (exact) return exact;

  const normalized = decoded
    .replace(/\s*-\s*S\.\d+.*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[:]/g, ' ')
    .trim();
  const normalizedLower = normalized.toLowerCase();

  for (const f of pdfFiles) {
    const base = path.basename(f.name, path.extname(f.name));
    const baseLower = base.toLowerCase().replace(/[:]/g, ' ');
    if (normalizedLower.includes(baseLower) || baseLower.includes(normalizedLower.slice(0, 50))) {
      return f;
    }
  }

  const firstPart = normalized.slice(0, 70);
  const byStarts = pdfFiles.find((f) => {
    const base = path.basename(f.name, path.extname(f.name)).replace(/[:]/g, ' ');
    return firstPart.includes(base) || base.includes(normalized.slice(0, 35));
  });
  if (byStarts) return byStarts;

  // Şirket Hafızası / Saha Çözümü: anahtar kelime skorlaması
  if (/şirket\s*hafızası|saha\s*çözüm/i.test(decoded)) {
    const keywords = extractKeywords(decoded);
    let best = null;
    let bestScore = 0;
    for (const f of pdfFiles) {
      const base = path.basename(f.name, path.extname(f.name)).toUpperCase();
      let score = 0;
      for (const kw of keywords) {
        if (base.includes(kw)) score += 2;
        if (base.includes(kw.slice(0, 4))) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (best) return best;

    // Valf, ısınma, elektrik, pres konuları için öncelikli PDF
    const topicKeywords = ['VALF', 'ISINMA', 'ELEKTRIK', 'ELEKTRİK', 'PRES', 'PH5000', 'YV90', 'ARIZA'];
    const hasTopic = topicKeywords.some((tk) => normalized.toUpperCase().includes(tk));
    if (hasTopic) {
      const preferred = pdfFiles.find((f) => {
        const b = path.basename(f.name, path.extname(f.name)).toUpperCase();
        return b.includes('ELEKTRIK') || b.includes('ELEKTRİK') || b.includes('TALIMAT') || b.includes('KULLANIM');
      });
      if (preferred) return preferred;
    }

    return pdfFiles[0];
  }

  return null;
}

/**
 * Önce bulur; bulursa 200 + url döner, bulamazsa 404. Frontend buna göre yeni sekme açar veya mesaj gösterir.
 * GET /api/docs-public/resolve?name=...
 */
docsPublicRouter.get('/resolve', async (req, res) => {
  const name = req.query.name;
  const page = req.query.page;
  if (!name || typeof name !== 'string' || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ ok: false, error: 'Geçersiz istek.' });
  }
  try {
    const files = await listFilesRecursive(DOCS_PUBLIC_DIR, '');
    const found = findBestFileMatch(name, files);
    if (!found) {
      return res.status(404).json({ ok: false, error: 'Dosya bulunamadı.', requested: name });
    }
    let urlPath = `/api/docs-public/${found.relativePath.split(path.sep).join('/')}`;
    if (page != null && String(page).trim() !== '') {
      const p = parseInt(String(page).trim(), 10);
      if (!Number.isNaN(p) && p >= 1) urlPath += `#page=${p}`;
    }
    const base = (process.env.API_BASE_URL || process.env.BASE_URL || '');
    res.json({ ok: true, url: base ? `${base}${urlPath}` : urlPath });
  } catch (err) {
    console.error('docs-public resolve error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PDF sayfa önizleme görseli (snippet). Frontend'de "İlgili sayfalar" kartlarında gösterilir.
 * GET /api/docs-public/page-preview?name=...&page=1
 */
docsPublicRouter.get('/page-preview', async (req, res) => {
  const name = req.query.name;
  const pageParam = req.query.page;
  if (!name || typeof name !== 'string' || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Geçersiz istek.' });
  }
  try {
    const files = await listFilesRecursive(DOCS_PUBLIC_DIR, '');
    const found = findBestFileMatch(name, files);
    if (!found) {
      console.warn('[page-preview] Dosya bulunamadı:', { requested: name, pdfCount: files.filter((f) => /\.pdf$/i.test(f.name)).length });
      return res.status(404).json({ error: 'Dosya bulunamadı.', requested: name });
    }
    const pageNum = pageParam != null && String(pageParam).trim() !== ''
      ? Math.max(1, parseInt(String(pageParam).trim(), 10) || 1)
      : 1;
    const filePath = path.join(DOCS_PUBLIC_DIR, found.relativePath);
    const buffer = await fs.readFile(filePath);
    const doc = await pdf(buffer, { scale: 1.5 });
    let pageIndex = 0;
    for await (const img of doc) {
      pageIndex++;
      if (pageIndex === pageNum) {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(img);
      }
    }
    console.warn('[page-preview] Sayfa bulunamadı:', { requested: name, page: pageNum });
    return res.status(404).json({ error: 'Sayfa bulunamadı.', page: pageNum });
  } catch (err) {
    console.error('[page-preview] Hata:', err.message, { requested: name });
    return res.status(500).json({ error: err.message });
  }
});

docsPublicRouter.get('/open', async (req, res) => {
  const name = req.query.name;
  const page = req.query.page;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Geçerli dosya adı gerekli.' });
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Geçersiz dosya adı.' });
  }
  try {
    const files = await listFilesRecursive(DOCS_PUBLIC_DIR, '');
    const found = findBestFileMatch(name, files);
    if (!found) {
      return res.status(404).json({ error: 'Dosya bulunamadı.', requested: name });
    }
    let urlPath = `/api/docs-public/${found.relativePath.split(path.sep).join('/')}`;
    if (page != null && String(page).trim() !== '') {
      const p = parseInt(String(page).trim(), 10);
      if (!Number.isNaN(p) && p >= 1) urlPath += `#page=${p}`;
    }
    res.redirect(302, urlPath);
  } catch (err) {
    console.error('docs-public open error:', err);
    res.status(500).json({ error: err.message });
  }
});
