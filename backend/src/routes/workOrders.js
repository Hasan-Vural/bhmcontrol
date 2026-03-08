import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const workOrdersRouter = Router();

// İş emri oluştur
workOrdersRouter.post('/', async (req, res) => {
  try {
    const { machineId, faultEventId, aiSessionId, title, description, priority, estimatedMinutes, createdByUserId } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title zorunludur.' });
    }

    const data = {
      title: title.trim(),
      description: description || null,
      machineId: machineId || null,
      faultEventId: faultEventId || null,
      aiSessionId: aiSessionId || null,
      status: 'OPEN',
      priority: normalizePriority(priority),
      estimatedMinutes: estimatedMinutes ?? null,
      createdByUserId: createdByUserId || null,
    };

    const workOrder = await prisma.workOrder.create({ data });
    return res.status(201).json(workOrder);
  } catch (e) {
    console.error('Work order create error:', e);
    return res.status(500).json({ error: 'İş emri oluşturulurken bir hata oluştu.', details: e.message });
  }
});

// İş emri listesi (filtrelenebilir)
workOrdersRouter.get('/', async (req, res) => {
  try {
    const { machineId, status } = req.query;

    const where = {};
    if (machineId) {
      where.machineId = String(machineId);
    }
    if (status) {
      where.status = normalizeStatus(status);
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        machine: { select: { id: true, name: true } },
      },
    });

    return res.json(workOrders);
  } catch (e) {
    console.error('Work order list error:', e);
    return res.status(500).json({ error: 'İş emirleri listelenirken bir hata oluştu.', details: e.message });
  }
});

// İş emri detayı
workOrdersRouter.get('/:id', async (req, res) => {
  try {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      include: {
        machine: { select: { id: true, name: true } },
        faultEvent: true,
        aiSession: true,
      },
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'İş emri bulunamadı.' });
    }

    return res.json(workOrder);
  } catch (e) {
    console.error('Work order detail error:', e);
    return res.status(500).json({ error: 'İş emri detayı alınırken bir hata oluştu.', details: e.message });
  }
});

// İş emri güncelle (durum, açıklama vb.)
workOrdersRouter.patch('/:id', async (req, res) => {
  try {
    const { status, description, priority, estimatedMinutes, closedAt } = req.body || {};

    const data = {};
    if (status) data.status = normalizeStatus(status);
    if (description !== undefined) data.description = description;
    if (priority) data.priority = normalizePriority(priority);
    if (estimatedMinutes !== undefined) data.estimatedMinutes = estimatedMinutes;
    if (closedAt !== undefined) data.closedAt = closedAt ? new Date(closedAt) : null;

    const updated = await prisma.workOrder.update({
      where: { id: req.params.id },
      data,
    });

    return res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'İş emri bulunamadı.' });
    }
    console.error('Work order update error:', e);
    return res.status(500).json({ error: 'İş emri güncellenirken bir hata oluştu.', details: e.message });
  }
});

function normalizePriority(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'LOW') return 'LOW';
  if (p === 'HIGH') return 'HIGH';
  if (p === 'CRITICAL') return 'CRITICAL';
  return 'MEDIUM';
}

function normalizeStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'OPEN') return 'OPEN';
  if (s === 'IN_PROGRESS' || s === 'IN-PROGRESS') return 'IN_PROGRESS';
  if (s === 'DONE' || s === 'CLOSED') return 'DONE';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
  return 'OPEN';
}

