import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const resolutionsRouter = Router();

resolutionsRouter.get('/', async (req, res) => {
  try {
    const { faultCodeId } = req.query;
    const resolutions = await prisma.faultResolution.findMany({
      where: faultCodeId ? { faultCodeId } : undefined,
      include: { faultCode: true },
      orderBy: [{ faultCodeId: 'asc' }, { stepOrder: 'asc' }],
    });
    res.json(resolutions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

resolutionsRouter.get('/:id', async (req, res) => {
  try {
    const resolution = await prisma.faultResolution.findUnique({
      where: { id: req.params.id },
      include: { faultCode: true },
    });
    if (!resolution) return res.status(404).json({ error: 'Not found' });
    res.json(resolution);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

resolutionsRouter.post('/', async (req, res) => {
  try {
    const { faultCodeId, stepOrder, title, description, toolsRequired, estimatedMinutes } = req.body;
    const resolution = await prisma.faultResolution.create({
      data: {
        faultCodeId,
        stepOrder: stepOrder ?? 0,
        title: title || 'Adım',
        description: description || null,
        toolsRequired: Array.isArray(toolsRequired) ? toolsRequired : [],
        estimatedMinutes: estimatedMinutes ?? null,
      },
    });
    res.status(201).json(resolution);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

resolutionsRouter.patch('/:id', async (req, res) => {
  try {
    const { stepOrder, title, description, toolsRequired, estimatedMinutes } = req.body;
    const resolution = await prisma.faultResolution.update({
      where: { id: req.params.id },
      data: {
        ...(stepOrder != null && { stepOrder }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(toolsRequired != null && { toolsRequired: Array.isArray(toolsRequired) ? toolsRequired : [] }),
        ...(estimatedMinutes != null && { estimatedMinutes }),
      },
    });
    res.json(resolution);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});

resolutionsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.faultResolution.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});
