import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { askAi } from '../services/aiProvider.js';

export const docChatRouter = Router();

/**
 * Belgeye özel sohbet listesi
 * GET /api/doc-chat/conversations?documentName=
 */
docChatRouter.get('/conversations', async (req, res) => {
  try {
    const { documentName } = req.query;
    if (!documentName || typeof documentName !== 'string' || !documentName.trim()) {
      return res.status(400).json({ error: 'Belge adı gerekli.' });
    }

    const list = await prisma.docChatConversation.findMany({
      where: { documentName: documentName.trim() },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        documentName: true,
        pageScope: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return res.json(list);
  } catch (e) {
    console.error('DocChat listConversations error:', e);
    return res.status(500).json({ error: 'Sohbetler listelenirken hata oluştu.' });
  }
});

/**
 * Tek sohbet + mesajlar
 * GET /api/doc-chat/conversations/:id
 */
docChatRouter.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conv = await prisma.docChatConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) {
      return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    }
    return res.json(conv);
  } catch (e) {
    console.error('DocChat getConversation error:', e);
    return res.status(500).json({ error: 'Sohbet yüklenirken hata oluştu.' });
  }
});

/**
 * Yeni sohbet oluştur
 * POST /api/doc-chat/conversations
 * Body: { documentName, pageScope?, title? }
 */
docChatRouter.post('/conversations', async (req, res) => {
  try {
    const { documentName, pageScope, title } = req.body || {};
    if (!documentName || typeof documentName !== 'string' || !documentName.trim()) {
      return res.status(400).json({ error: 'Belge adı gerekli.' });
    }

    const conv = await prisma.docChatConversation.create({
      data: {
        documentName: documentName.trim(),
        pageScope: pageScope != null ? String(pageScope) : null,
        title: title != null ? String(title).trim() || null : null,
      },
    });

    return res.status(201).json(conv);
  } catch (e) {
    console.error('DocChat createConversation error:', e);
    return res.status(500).json({ error: 'Sohbet oluşturulurken hata oluştu.' });
  }
});

/**
 * Sohbet sil
 * DELETE /api/doc-chat/conversations/:id
 */
docChatRouter.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.docChatConversation.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    }
    console.error('DocChat deleteConversation error:', e);
    return res.status(500).json({ error: 'Sohbet silinirken hata oluştu.' });
  }
});

/**
 * Belgeye özel AI sorgusu
 * POST /api/doc-chat/query
 * Body: { question, conversationId?, documentName, pageScope?, messages[] }
 */
docChatRouter.post('/query', async (req, res) => {
  try {
    const { question, conversationId, documentName, pageScope, messages } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Geçerli bir soru göndermelisiniz.' });
    }
    if (!documentName || typeof documentName !== 'string' || !documentName.trim()) {
      return res.status(400).json({ error: 'Belge adı gerekli.' });
    }

    const docName = documentName.trim();
    const pageScopeStr = pageScope != null ? String(pageScope) : null;

    // Sayfa listesini parse et: "173" | "173,174,175" | "173-175" | "all" | null
    let pages = null;
    if (pageScopeStr && pageScopeStr !== 'all') {
      const parts = pageScopeStr.split(/[,\s]+/);
      const parsed = [];
      for (const p of parts) {
        const range = p.match(/^(\d+)-(\d+)$/);
        if (range) {
          const [_, a, b] = range;
          for (let i = parseInt(a, 10); i <= parseInt(b, 10); i++) parsed.push(i);
        } else {
          const n = parseInt(p, 10);
          if (!isNaN(n)) parsed.push(n);
        }
      }
      if (parsed.length > 0) pages = [...new Set(parsed)].sort((a, b) => a - b);
    }

    const documentContext = pages && pages.length > 0
      ? { source: docName, pages }
      : pageScopeStr === 'all'
        ? { source: docName, pages: null }
        : null;

    const prevMessages = Array.isArray(messages) ? messages : [];
    const currentUserId = req.user?.id || null;

    const aiResponse = await askAi({
      question: question.trim(),
      mode: 'detailed',
      machineId: null,
      machineCode: null,
      userId: currentUserId,
      documentContext,
      conversationHistory: prevMessages.map((m) => ({
        role: m.role,
        content: m.content || '',
      })),
    });

    const answerText =
      aiResponse.detailed_answer || aiResponse.short_answer || 'Yanıt alınamadı.';

    let conv = null;
    if (conversationId) {
      conv = await prisma.docChatConversation.findUnique({ where: { id: conversationId } });
      if (!conv) {
        conv = await prisma.docChatConversation.create({
          data: {
            documentName: docName,
            pageScope: pageScopeStr,
            title: `Sohbet ${new Date().toLocaleDateString('tr-TR')}`,
          },
        });
      }
    } else {
      conv = await prisma.docChatConversation.create({
        data: {
          documentName: docName,
          pageScope: pageScopeStr,
          title: `Sohbet ${new Date().toLocaleDateString('tr-TR')}`,
        },
      });
    }

    const userMsg = await prisma.docChatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'user',
        content: question.trim(),
      },
    });

    const assistantMsg = await prisma.docChatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: answerText,
        attachments: aiResponse.attachments?.length ? aiResponse.attachments : null,
      },
    });

    await prisma.docChatConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return res.json({
      conversationId: conv.id,
      conversation: {
        ...conv,
        messages: [...(conv.messages || []), userMsg, assistantMsg],
      },
      userMessage: userMsg,
      assistantMessage: {
        ...assistantMsg,
        content: answerText,
        attachments: aiResponse.attachments || [],
      },
    });
  } catch (e) {
    console.error('DocChat query error:', e);
    return res.status(500).json({ error: 'AI sorgusu sırasında bir hata oluştu.' });
  }
});
