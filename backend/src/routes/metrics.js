import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const metricsRouter = Router();

// Prometheus formatında metrik endpoint'i
metricsRouter.get('/', async (req, res) => {
  try {
    // Açık alert sayıları (severity bazlı)
    const alertCounts = await prisma.alert.groupBy({
      by: ['severity'],
      where: { status: 'OPEN' },
      _count: { id: true },
    });

    // Makine bazlı açık alert sayıları
    const machineAlertCounts = await prisma.alert.groupBy({
      by: ['machineId'],
      where: { status: 'OPEN' },
      _count: { id: true },
    });

    // Makine bilgilerini al
    const machineIds = machineAlertCounts.map((m) => m.machineId);
    const machines = await prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true, name: true },
    });
    const machineMap = new Map(machines.map((m) => [m.id, m.name]));

    // Toplam açık alert sayısı
    const totalOpen = await prisma.alert.count({ where: { status: 'OPEN' } });

    // Toplam çözülen alert sayısı (son 24 saat)
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    const resolved24h = await prisma.alert.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: { gte: last24h },
      },
    });

    // Prometheus formatında metrikler
    const lines = [];

    // Açık alert sayıları (severity bazlı)
    lines.push('# TYPE alerts_open_by_severity gauge');
    const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, INFO: 0 };
    alertCounts.forEach((item) => {
      severityMap[item.severity] = item._count.id;
    });
    Object.entries(severityMap).forEach(([severity, count]) => {
      lines.push(`alerts_open_by_severity{severity="${severity}"} ${count}`);
    });

    // Toplam açık alert
    lines.push('# TYPE alerts_open_total gauge');
    lines.push(`alerts_open_total ${totalOpen}`);

    // Makine bazlı açık alert sayıları
    lines.push('# TYPE alerts_open_by_machine gauge');
    machineAlertCounts.forEach((item) => {
      const machineName = machineMap.get(item.machineId) || 'unknown';
      lines.push(`alerts_open_by_machine{machine_id="${item.machineId}",machine_name="${machineName}"} ${item._count.id}`);
    });

    // Son 24 saatte çözülen alert sayısı
    lines.push('# TYPE alerts_resolved_24h counter');
    lines.push(`alerts_resolved_24h ${resolved24h}`);

    // Content-Type: text/plain; version=0.0.4
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
