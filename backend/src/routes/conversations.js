import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const conversationsRouter = Router();

// Tüm sohbetleri listele (mevcut kullanıcı için)
conversationsRouter.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(list);
  } catch (e) {
    console.error('Conversations list error:', e);
    return res.status(500).json({ error: 'Sohbetler listelenirken hata oluştu.', details: e.message });
  }
});

// Yeni sohbet oluştur
conversationsRouter.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, messages } = req.body || {};

    const conv = await prisma.conversation.create({
      data: {
        userId,
        title: (title && String(title).trim()) || 'Sohbet',
        messages: Array.isArray(messages) ? messages : [],
      },
    });

    return res.status(201).json(conv);
  } catch (e) {
    console.error('Conversation create error:', e);
    return res.status(500).json({ error: 'Sohbet oluşturulurken hata oluştu.', details: e.message });
  }
});

// Sohbet güncelle (başlık / mesajlar)
conversationsRouter.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, messages } = req.body || {};

    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    }

    const data = {};
    if (title !== undefined) {
      data.title = String(title).trim() || existing.title;
    }
    if (messages !== undefined) {
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages alanı dizi olmalıdır.' });
      }
      data.messages = messages;
    }

    const updated = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (e) {
    console.error('Conversation update error:', e);
    return res.status(500).json({ error: 'Sohbet güncellenirken hata oluştu.', details: e.message });
  }
});

