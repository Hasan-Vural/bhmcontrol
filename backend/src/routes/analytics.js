import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const analyticsRouter = Router();

// Genel özet
analyticsRouter.get('/overview', async (req, res) => {
  try {
    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(String(sinceParam)) : null;

    const whereFault = since ? { createdAt: { gte: since } } : {};
    const whereWo = since ? { createdAt: { gte: since } } : {};

    const [machines, faultEvents, workOrders] = await Promise.all([
      prisma.machine.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.faultEvent.findMany({ where: whereFault }),
      prisma.workOrder.findMany({ where: whereWo }),
    ]);

    const machineMap = new Map(machines.map((m) => [m.id, m.name]));

    // En çok hata veren makineler
    const faultsByMachine = new Map();
    faultEvents.forEach((f) => {
      const count = faultsByMachine.get(f.machineId) || 0;
      faultsByMachine.set(f.machineId, count + 1);
    });

    const topFaultMachines = Array.from(faultsByMachine.entries())
      .map(([machineId, count]) => ({
        machineId,
        machineName: machineMap.get(machineId) || 'Bilinmiyor',
        faultCount: count,
      }))
      .sort((a, b) => b.faultCount - a.faultCount)
      .slice(0, 5);

    // Hata kodu frekansı
    const faultsByCode = new Map();
    faultEvents.forEach((f) => {
      if (!f.faultCodeId) return;
      const count = faultsByCode.get(f.faultCodeId) || 0;
      faultsByCode.set(f.faultCodeId, count + 1);
    });

    const faultCodeIds = Array.from(faultsByCode.keys());
    const faultCodes = await prisma.faultCode.findMany({
      where: { id: { in: faultCodeIds } },
      select: { id: true, code: true, title: true },
    });
    const faultCodeMap = new Map(faultCodes.map((fc) => [fc.id, fc]));

    const topFaultCodes = Array.from(faultsByCode.entries())
      .map(([faultCodeId, count]) => {
        const info = faultCodeMap.get(faultCodeId);
        return {
          faultCodeId,
          code: info?.code || '—',
          title: info?.title || 'Bilinmiyor',
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // İş emri istatistikleri
    const openCount = workOrders.filter((wo) => wo.status === 'OPEN' || wo.status === 'IN_PROGRESS').length;
    const done = workOrders.filter((wo) => wo.status === 'DONE' && wo.closedAt);
    const avgCloseMinutes =
      done.length > 0
        ? Math.round(
            done.reduce((sum, wo) => sum + (wo.closedAt.getTime() - wo.createdAt.getTime()) / 60000, 0) / done.length,
          )
        : null;

    res.json({
      topFaultMachines,
      topFaultCodes,
      workOrders: {
        total: workOrders.length,
        open: openCount,
        avgCloseMinutes,
      },
    });
  } catch (e) {
    console.error('Analytics overview error:', e);
    res.status(500).json({ error: 'Analytics overview hesaplanırken bir hata oluştu.', details: e.message });
  }
});

// Makine sıralaması
analyticsRouter.get('/machine-ranking', async (req, res) => {
  try {
    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(String(sinceParam)) : null;

    const whereFault = since ? { createdAt: { gte: since } } : {};

    const [machines, faultEvents] = await Promise.all([
      prisma.machine.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.faultEvent.findMany({ where: whereFault }),
    ]);

    const machineMap = new Map(machines.map((m) => [m.id, m.name]));
    const faultsByMachine = new Map();
    faultEvents.forEach((f) => {
      const count = faultsByMachine.get(f.machineId) || 0;
      faultsByMachine.set(f.machineId, count + 1);
    });

    const ranking = machines
      .map((m) => ({
        machineId: m.id,
        machineName: m.name,
        faultCount: faultsByMachine.get(m.id) || 0,
      }))
      .sort((a, b) => b.faultCount - a.faultCount);

    res.json(ranking);
  } catch (e) {
    console.error('Analytics machine ranking error:', e);
    res.status(500).json({ error: 'Makine sıralaması hesaplanırken bir hata oluştu.', details: e.message });
  }
});

// AI kullanım istatistikleri
analyticsRouter.get('/ai-usage', async (req, res) => {
  try {
    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(String(sinceParam)) : null;

    const whereSession = since ? { createdAt: { gte: since } } : {};

    const [sessions, feedbacks] = await Promise.all([
      prisma.aiSession.findMany({ where: whereSession }),
      prisma.aiFeedback.findMany({
        where: since ? { createdAt: { gte: since } } : {},
      }),
    ]);

    const totalSessions = sessions.length;
    const byMode = {
      SHORT: sessions.filter((s) => s.mode === 'SHORT').length,
      DETAILED: sessions.filter((s) => s.mode === 'DETAILED').length,
      WORK_ORDER: sessions.filter((s) => s.mode === 'WORK_ORDER').length,
    };

    const successCount = feedbacks.filter((f) => f.result === 'SUCCESS').length;
    const failCount = feedbacks.filter((f) => f.result === 'FAIL').length;
    const partialCount = feedbacks.filter((f) => f.result === 'PARTIAL').length;

    res.json({
      totalSessions,
      byMode,
      feedback: {
        success: successCount,
        fail: failCount,
        partial: partialCount,
      },
    });
  } catch (e) {
    console.error('Analytics ai usage error:', e);
    res.status(500).json({ error: 'AI kullanım istatistikleri hesaplanırken bir hata oluştu.', details: e.message });
  }
});

