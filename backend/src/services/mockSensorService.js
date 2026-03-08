import { prisma } from '../lib/prisma.js';

const INTERVAL_MS = 8000;
// Seramik hidrolik pres için gerçekçi aralıklar (3000-8000 ton eşdeğeri)
const RANGES = {
  pressure: { min: 4000, max: 7500, unit: 'psi' },
  temperature: { min: 80, max: 180, unit: 'C' },
  vibration: { min: 3, max: 12, unit: 'htz' },
  gasFlow: { min: 1.5, max: 4, unit: 'kg/s' },
};

// Eşikler: pres senaryosuna uyarlanmış
const THRESHOLDS = {
  temperature: { threshold: 170, faultCodeCode: 'E101', direction: 'above' }, // Sıcaklık > 170°C → E101
  pressure: { threshold: 4500, faultCodeCode: 'E102', direction: 'below' }, // Basınç < 4500 psi → E102
};

const state = new Map(); // machineId -> { pressure, temperature, vibration, gasFlow }
const alertCheckCache = new Map(); // machineId -> { faultCodeCode -> lastChecked timestamp }

function randomInRange(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function getOrInitMachine(machineId) {
  if (!state.has(machineId)) {
    state.set(machineId, {
      pressure: randomInRange(RANGES.pressure.min, RANGES.pressure.max),
      temperature: randomInRange(RANGES.temperature.min, RANGES.temperature.max),
      vibration: randomInRange(RANGES.vibration.min, RANGES.vibration.max),
      gasFlow: randomInRange(RANGES.gasFlow.min, RANGES.gasFlow.max),
    });
  }
  return state.get(machineId);
}

function tickMachine(machineId) {
  const m = getOrInitMachine(machineId);
  const next = { ...m };
  next.pressure = Math.max(RANGES.pressure.min, Math.min(RANGES.pressure.max, m.pressure + (Math.random() - 0.5) * 80));
  next.temperature = Math.max(RANGES.temperature.min, Math.min(RANGES.temperature.max, m.temperature + (Math.random() - 0.5) * 20));
  next.vibration = Math.max(RANGES.vibration.min, Math.min(RANGES.vibration.max, m.vibration + (Math.random() - 0.5) * 2));
  next.gasFlow = Math.max(RANGES.gasFlow.min, Math.min(RANGES.gasFlow.max, m.gasFlow + (Math.random() - 0.5) * 0.5));
  state.set(machineId, next);
  return next;
}

export function getMockReadingsForMachines(machineIds) {
  const result = {};
  for (const id of machineIds) {
    const m = getOrInitMachine(id);
    result[id] = [
      { type: 'pressure', value: m.pressure, unit: RANGES.pressure.unit },
      { type: 'temperature', value: m.temperature, unit: RANGES.temperature.unit },
      { type: 'vibration', value: m.vibration, unit: RANGES.vibration.unit },
      { type: 'gasFlow', value: m.gasFlow, unit: RANGES.gasFlow.unit },
    ];
  }
  return result;
}

async function checkThresholdsAndCreateAlerts() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const machine of machines) {
      const machineId = machine.id;
      const readings = getOrInitMachine(machineId);

      // Her sensör için eşik kontrolü
      for (const [sensorType, config] of Object.entries(THRESHOLDS)) {
        const value = readings[sensorType];
        if (value === undefined) continue;

        const shouldAlert =
          config.direction === 'above' ? value > config.threshold : value < config.threshold;

        if (shouldAlert) {
          // Aynı makine ve hata kodu için zaten açık alert var mı kontrol et
          const faultCode = await prisma.faultCode.findFirst({
            where: { code: config.faultCodeCode },
          });

          if (!faultCode) continue;

          const existingAlert = await prisma.alert.findFirst({
            where: {
              machineId,
              faultCodeId: faultCode.id,
              status: 'OPEN',
            },
          });

          // Eğer açık alert yoksa yeni oluştur
          if (!existingAlert) {
            await prisma.alert.create({
              data: {
                machineId,
                faultCodeId: faultCode.id,
                severity: faultCode.severity,
                message: `${faultCode.code}: ${faultCode.title} - ${sensorType} değeri eşiği aştı (${value})`,
                status: 'OPEN',
              },
            });
            console.log(`[Alert] ${machineId}: ${faultCode.code} oluşturuldu (${sensorType}=${value})`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Alert Check Error]', error.message);
  }
}

export function startMockSensorService() {
  setInterval(() => {
    for (const machineId of state.keys()) {
      tickMachine(machineId);
    }
  }, INTERVAL_MS);

  // Her 10 saniyede bir eşik kontrolü yap
  setInterval(() => {
    checkThresholdsAndCreateAlerts();
  }, 10000);
}

export function registerMachineIds(machineIds) {
  machineIds.forEach((id) => getOrInitMachine(id));
}
