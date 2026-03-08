import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const machinesRouter = Router();

machinesRouter.get('/', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { alerts: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(machines);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

machinesRouter.get('/:id', async (req, res) => {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: req.params.id },
      include: {
        alerts: { where: { status: { not: 'RESOLVED' } }, include: { faultCode: true } },
        sensorReadings: {
          orderBy: { timestamp: 'desc' },
          take: 4,
          distinct: ['type'],
        },
      },
    });
    if (!machine) return res.status(404).json({ error: 'Not found' });
    res.json(machine);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

machinesRouter.post('/', async (req, res) => {
  try {
    const { name, type, location, isActive } = req.body;
    const machine = await prisma.machine.create({
      data: {
        name: name || 'Yeni Makine',
        type: type === 'hydraulic' ? 'hydraulic' : 'electrical',
        location: location || null,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(machine);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

machinesRouter.patch('/:id', async (req, res) => {
  try {
    const { name, type, location, isActive } = req.body;
    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name }),
        ...(type != null && { type: type === 'hydraulic' ? 'hydraulic' : 'electrical' }),
        ...(location != null && { location }),
        ...(isActive != null && { isActive }),
      },
    });
    res.json(machine);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});

machinesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.machine.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});
