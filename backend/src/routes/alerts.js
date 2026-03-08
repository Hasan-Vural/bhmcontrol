import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const alertsRouter = Router();

alertsRouter.get('/', async (req, res) => {
  try {
    const { status, machineId, severity } = req.query;
    const alerts = await prisma.alert.findMany({
      where: {
        ...(status && { status }),
        ...(machineId && { machineId }),
        ...(severity && { severity }),
      },
      include: {
        machine: true,
        faultCode: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

alertsRouter.get('/count', async (req, res) => {
  try {
    const { status = 'OPEN' } = req.query;
    const count = await prisma.alert.count({
      where: status ? { status } : undefined,
    });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

alertsRouter.get('/:id', async (req, res) => {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: {
        machine: true,
        faultCode: { include: { resolutions: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    if (!alert) return res.status(404).json({ error: 'Not found' });
    res.json(alert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

alertsRouter.post('/', async (req, res) => {
  try {
    const { machineId, faultCodeId, severity, message } = req.body;
    const faultCode = faultCodeId ? await prisma.faultCode.findUnique({ where: { id: faultCodeId } }) : null;
    const alert = await prisma.alert.create({
      data: {
        machineId,
        faultCodeId: faultCode?.id || faultCodeId,
        severity: severity || faultCode?.severity || 'MEDIUM',
        message: message || faultCode?.title || 'Arıza',
        status: 'OPEN',
      },
      include: { machine: true, faultCode: true },
    });
    res.status(201).json(alert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

alertsRouter.post('/test', async (req, res) => {
  try {
    const [machine, faultCode] = await Promise.all([
      prisma.machine.findFirst({ where: { isActive: true } }),
      prisma.faultCode.findFirst(),
    ]);
    if (!machine || !faultCode) return res.status(400).json({ error: 'No machine or fault code in DB' });
    const alert = await prisma.alert.create({
      data: {
        machineId: machine.id,
        faultCodeId: faultCode.id,
        severity: faultCode.severity,
        message: `Test: ${faultCode.code} - ${faultCode.title}`,
        status: 'OPEN',
      },
      include: { machine: true, faultCode: true },
    });
    res.status(201).json(alert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

alertsRouter.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'ACKNOWLEDGED') update.acknowledgedAt = new Date();
    if (status === 'RESOLVED') update.resolvedAt = new Date();
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: update,
      include: { machine: true, faultCode: true },
    });
    res.json(alert);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: e.message });
  }
});
