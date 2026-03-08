import { Router } from 'express';
import { getMockReadingsForMachines } from '../services/mockSensorService.js';
import { prisma } from '../lib/prisma.js';

export const sensorMockRouter = Router();

sensorMockRouter.get('/latest', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const machineIds = machines.map((m) => m.id);
    const readings = getMockReadingsForMachines(machineIds);
    res.json(readings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

sensorMockRouter.get('/latest/:machineId', async (req, res) => {
  try {
    const readings = getMockReadingsForMachines([req.params.machineId]);
    res.json(readings[req.params.machineId] || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
