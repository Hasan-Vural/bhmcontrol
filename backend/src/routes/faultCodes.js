import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const faultCodesRouter = Router();

faultCodesRouter.get('/', async (req, res) => {
  try {
    const { severity, category } = req.query;
    const faultCodes = await prisma.faultCode.findMany({
      where: {
        ...(severity && { severity }),
        ...(category && { category }),
      },
      include: {
        _count: { select: { resolutions: true, alerts: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(faultCodes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

faultCodesRouter.get('/:id', async (req, res) => {
  try {
    const faultCode = await prisma.faultCode.findUnique({
      where: { id: req.params.id },
      include: { resolutions: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!faultCode) return res.status(404).json({ error: 'Not found' });
    res.json(faultCode);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

faultCodesRouter.post('/', async (req, res) => {
  try {
    const { code, title, description, severity, category, responsibleRole } = req.body;
    const faultCode = await prisma.faultCode.create({
      data: {
        code: code || 'E???',
        title: title || 'Yeni hata',
        description: description || null,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].includes(severity) ? severity : 'MEDIUM',
        category: category || null,
        responsibleRole: responsibleRole || null,
      },
    });
    res.status(201).json(faultCode);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

faultCodesRouter.patch('/:id', async (req, res) => {
  try {
    const { code, title, description, severity, category, responsibleRole } = req.body;
    const faultCode = await prisma.faultCode.update({
      where: { id: req.params.id },
      data: {
        ...(code != null && { code }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(severity != null && ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].includes(severity) && { severity }),
        ...(category != null && { category }),
        ...(responsibleRole != null && { responsibleRole }),
      },
    });
    res.json(faultCode);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});

faultCodesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.faultCode.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});
