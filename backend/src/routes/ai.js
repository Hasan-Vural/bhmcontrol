import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { askAi } from '../services/aiProvider.js';

export const aiRouter = Router();

/**
 * AI konsolu için ana sorgu endpoint'i
 * POST /api/ai/query
 *
 * Body:
 *  - question: string
 *  - mode: 'short' | 'detailed' | 'work_order'
 *  - machineId?: string
 *  - userId?: string
 *  - autoCreateWorkOrder?: boolean
 */
aiRouter.post('/query', async (req, res) => {
  try {
    const { question, mode, machineId, autoCreateWorkOrder } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Geçerli bir soru göndermelisiniz.' });
    }

    const normalizedMode = normalizeMode(mode);
    if (!normalizedMode) {
      return res.status(400).json({ error: 'Geçersiz sorgu modu.' });
    }

    let machine = null;
    if (machineId) {
      machine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: { id: true, name: true },
      });
      if (!machine) {
        return res.status(404).json({ error: 'Makine bulunamadı.' });
      }
    }

    const currentUserId = req.user?.id || null;

    // Mock AI sağlayıcısını çağır
    const aiResponse = await askAi({
      question: question.trim(),
      mode: normalizedMode,
      machineId: machine?.id,
      machineCode: machine?.name,
      userId: currentUserId,
    });

    // AiSession kaydı oluştur (DB yoksa veya hata varsa sessizce devam et)
    let session = null;
    try {
      if (prisma.aiSession?.create) {
        const prismaMode = toPrismaAiMode(aiResponse.mode);
        session = await prisma.aiSession.create({
          data: {
            userId: currentUserId,
            machineId: machine?.id || null,
            mode: prismaMode,
            question: question.trim(),
            aiShortAnswer: aiResponse.short_answer,
            aiDetailedAnswer: aiResponse.detailed_answer,
            aiRawJson: aiResponse,
          },
        });
      }
    } catch (err) {
      console.error('AiSession create error (dev mode, DB yok?):', err);
    }

    let createdWorkOrder = null;
    if (normalizedMode === 'work_order' && aiResponse.work_order_suggestion && autoCreateWorkOrder && session?.id) {
      try {
        if (prisma.workOrder?.create) {
          createdWorkOrder = await prisma.workOrder.create({
            data: {
              machineId: machine?.id || null,
              aiSessionId: session.id,
              title: aiResponse.work_order_suggestion.title,
              description: aiResponse.detailed_answer || aiResponse.short_answer,
              status: 'OPEN',
              priority: toPrismaPriority(aiResponse.work_order_suggestion.priority),
              estimatedMinutes: aiResponse.work_order_suggestion.estimated_duration_min || null,
              createdByUserId: currentUserId,
            },
          });
        }
      } catch (err) {
        console.error('WorkOrder create error (dev mode, DB yok?):', err);
      }
    }

    return res.json({
      sessionId: session?.id || null,
      workOrderId: createdWorkOrder?.id || null,
      ai: aiResponse,
    });
  } catch (e) {
    console.error('AI query error:', e);
    return res.status(500).json({ error: 'AI sorgusu sırasında bir hata oluştu.' });
  }
});

/**
 * AI cevabı için geri bildirim endpoint'i
 * POST /api/ai/feedback
 *
 * Body:
 *  - aiSessionId: string
 *  - result: 'SUCCESS' | 'FAIL' | 'PARTIAL'
 *  - comment?: string
 */
aiRouter.post('/feedback', async (req, res) => {
  try {
    const { aiSessionId, result, comment } = req.body || {};

    if (!aiSessionId || typeof aiSessionId !== 'string') {
      return res.status(400).json({ error: 'Geçersiz istek.' });
    }

    const normalizedResult = toFeedbackResult(result);
    if (!normalizedResult) {
      return res.status(400).json({ error: 'Geçersiz geri bildirim değeri.' });
    }

    // Oturum var mı kontrol et
    const session = await prisma.aiSession.findUnique({ where: { id: aiSessionId } });
    if (!session) {
      return res.status(404).json({ error: 'AI oturumu bulunamadı.' });
    }

    const feedback = await prisma.aiFeedback.create({
      data: {
        aiSessionId,
        result: normalizedResult,
        comment: comment || null,
      },
    });

    return res.status(201).json(feedback);
  } catch (e) {
    console.error('AI feedback error:', e);
    return res.status(500).json({ error: 'Geri bildirim kaydedilirken bir hata oluştu.' });
  }
});

function normalizeMode(mode) {
  if (!mode) return null;
  const m = String(mode).toLowerCase();
  if (m === 'short') return 'short';
  if (m === 'detailed') return 'detailed';
  if (m === 'work_order' || m === 'work-order' || m === 'workorder') return 'work_order';
  return null;
}

function toPrismaAiMode(mode) {
  switch (mode) {
    case 'short':
      return 'SHORT';
    case 'detailed':
      return 'DETAILED';
    case 'work_order':
      return 'WORK_ORDER';
    default:
      return 'SHORT';
  }
}

function toPrismaPriority(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'LOW') return 'LOW';
  if (p === 'HIGH') return 'HIGH';
  if (p === 'CRITICAL') return 'CRITICAL';
  return 'MEDIUM';
}

function toFeedbackResult(result) {
  const r = String(result || '').toUpperCase();
  if (r === 'SUCCESS') return 'SUCCESS';
  if (r === 'FAIL') return 'FAIL';
  if (r === 'PARTIAL') return 'PARTIAL';
  return null;
}


