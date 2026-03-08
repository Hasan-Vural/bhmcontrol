import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/auth.js';

export const sirketHafizasiRouter = Router();

// Yeni saha çözümü kaydı (PENDING)
sirketHafizasiRouter.post('/', async (req, res) => {
  try {
    const { faultCode, problem, solution, equipmentName } = req.body || {};

    if (!faultCode || !problem || !solution) {
      return res.status(400).json({ error: 'Hata kodu, problem ve çözüm zorunludur.' });
    }

    const created = await prisma.sahaCozumu.create({
      data: {
        faultCode: String(faultCode).trim(),
        problem: String(problem).trim(),
        solution: String(solution).trim(),
        equipmentName: equipmentName ? String(equipmentName).trim() : null,
        createdById: req.user.id,
      },
    });

    return res.status(201).json(created);
  } catch (e) {
    console.error('Saha çözümü kaydetme hatası:', e);
    return res.status(500).json({ error: 'Saha çözümü kaydedilirken hata oluştu.', details: e.message });
  }
});

// Onay bekleyen kayıtlar (kıdemli / admin)
sirketHafizasiRouter.get(
  '/pending',
  requireRole(['KIDEMLI_MUHENDIS', 'ADMIN']),
  async (req, res) => {
    try {
      const list = await prisma.sahaCozumu.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });
      return res.json(list);
    } catch (e) {
      console.error('Saha çözümü pending list error:', e);
      return res.status(500).json({ error: 'Onay bekleyen kayıtlar alınırken hata oluştu.', details: e.message });
    }
  },
);

// Onayla
sirketHafizasiRouter.patch(
  '/:id/approve',
  requireRole(['KIDEMLI_MUHENDIS', 'ADMIN']),
  async (req, res) => {
    try {
      const existing = await prisma.sahaCozumu.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ error: 'Kayıt bulunamadı.' });
      }

      const updated = await prisma.sahaCozumu.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          approvedById: req.user.id,
          approvedAt: new Date(),
          rejectionReason: null,
          rejectedAt: null,
        },
      });

      return res.json(updated);
    } catch (e) {
      console.error('Saha çözümü onay hatası:', e);
      return res.status(500).json({ error: 'Kayıt onaylanırken hata oluştu.', details: e.message });
    }
  },
);

// Reddet
sirketHafizasiRouter.patch(
  '/:id/reject',
  requireRole(['KIDEMLI_MUHENDIS', 'ADMIN']),
  async (req, res) => {
    try {
      const { reason } = req.body || {};
      const existing = await prisma.sahaCozumu.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ error: 'Kayıt bulunamadı.' });
      }

      const updated = await prisma.sahaCozumu.update({
        where: { id: existing.id },
        data: {
          status: 'REJECTED',
          approvedById: req.user.id,
          rejectedAt: new Date(),
          rejectionReason: reason ? String(reason).trim() : null,
        },
      });

      return res.json(updated);
    } catch (e) {
      console.error('Saha çözümü red hatası:', e);
      return res.status(500).json({ error: 'Kayıt reddedilirken hata oluştu.', details: e.message });
    }
  },
);

