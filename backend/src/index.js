import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { machinesRouter } from './routes/machines.js';
import { faultCodesRouter } from './routes/faultCodes.js';
import { resolutionsRouter } from './routes/resolutions.js';
import { alertsRouter } from './routes/alerts.js';
import { sensorMockRouter } from './routes/sensorMock.js';
import { metricsRouter } from './routes/metrics.js';
import { docsRouter } from './routes/docs.js';
import { docsPublicRouter } from './routes/docsPublic.js';
import { aiRouter } from './routes/ai.js';
import { workOrdersRouter } from './routes/workOrders.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { conversationsRouter } from './routes/conversations.js';
import { sirketHafizasiRouter } from './routes/sirketHafizasi.js';
import { docChatRouter } from './routes/docChat.js';
import { adminRouter } from './routes/admin.js';
import { authMiddleware } from './middleware/auth.js';
import { startMockSensorService, registerMachineIds } from './services/mockSensorService.js';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/docs-public', docsPublicRouter, express.static(path.join(__dirname, '../docs-public'))); // Tarayıcıda açılabilir dokümanlar
app.use('/metrics', metricsRouter); // Prometheus standart endpoint

// RAG servisi için onaylı saha çözümleri (okuma amaçlı)
app.get('/api/public/sirket-hafizasi/approved', async (req, res) => {
  try {
    const sinceParam = req.query.since;
    const faultCode = req.query.faultCode;
    const where = { status: 'APPROVED' };
    if (sinceParam) {
      where.createdAt = { gte: new Date(String(sinceParam)) };
    }
    if (faultCode) {
      where.faultCode = String(faultCode);
    }
    const list = await prisma.sahaCozumu.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json(list);
  } catch (e) {
    console.error('Public approved saha çözümleri hatası:', e);
    res.status(500).json({ error: 'Onaylı saha çözümleri alınırken hata oluştu.', details: e.message });
  }
});

// Kimlik doğrulama gerektiren API'ler
app.use('/api/machines', authMiddleware, machinesRouter);
app.use('/api/fault-codes', authMiddleware, faultCodesRouter);
app.use('/api/resolutions', authMiddleware, resolutionsRouter);
app.use('/api/alerts', authMiddleware, alertsRouter);
app.use('/api/work-orders', authMiddleware, workOrdersRouter);
app.use('/api/sensor-mock', authMiddleware, sensorMockRouter);
app.use('/api/metrics', authMiddleware, metricsRouter);
app.use('/api/docs', authMiddleware, docsRouter); // Dokümantasyon ve soru-cevap
app.use('/api/ai', authMiddleware, aiRouter); // Bakım AI Konsolu
app.use('/api/analytics', authMiddleware, analyticsRouter);
app.use('/api/conversations', authMiddleware, conversationsRouter);
app.use('/api/sirket-hafizasi', authMiddleware, sirketHafizasiRouter);
app.use('/api/doc-chat', authMiddleware, docChatRouter);
app.use('/api/admin', authMiddleware, adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

startMockSensorService();
prisma.machine.findMany({ where: { isActive: true }, select: { id: true } }).then((list) => {
  registerMachineIds(list.map((m) => m.id));
});

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
