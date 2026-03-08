import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { askQuestion, getDocumentInfo } from '../services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const docsRouter = Router();

const DOCS_DIR = path.join(__dirname, '../../docs');

// Multer konfigürasyonu - doküman yükleme için
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Klasör yoksa oluştur
    try {
      await fs.mkdir(DOCS_DIR, { recursive: true });
    } catch (error) {
      // Klasör zaten varsa hata vermez
    }
    cb(null, DOCS_DIR);
  },
  filename: (req, file, cb) => {
    // Orijinal dosya adını koru
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Desteklenmeyen dosya formatı. İzin verilen formatlar: ${allowedExts.join(', ')}`));
    }
  },
});

// Doküman listesini getir
docsRouter.get('/', async (req, res) => {
  try {
    const info = await getDocumentInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Doküman yükle
docsRouter.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    res.json({
      message: 'Doküman başarıyla yüklendi',
      filename: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soru sor
docsRouter.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Geçerli bir soru gönderilmedi' });
    }

    const result = await askQuestion(question.trim());
    res.json(result);
  } catch (error) {
    console.error('Soru-cevap hatası:', error);
    res.status(500).json({
      error: error.message,
      answer: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    });
  }
});

// Doküman sil
docsRouter.delete('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(DOCS_DIR, filename);

    // Güvenlik: sadece dosya adı kullan, path traversal önle
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Geçersiz dosya adı' });
    }

    await fs.unlink(filePath);
    res.json({ message: 'Doküman silindi', filename });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Dosya bulunamadı' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});
