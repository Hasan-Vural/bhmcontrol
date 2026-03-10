import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  // Admin
  { username: 'bhmcontrol', email: 'bhmcontrol@factory.local', name: 'BHM Kontrol', password: 'bhm123', role: 'ADMIN' },
  // Kıdemli teknisyen (mevcut temel kullanıcılar)
  { username: 'berke', email: 'berke@factory.local', name: 'Berke', password: 'Berke123', role: 'KIDEMLI_MUHENDIS' },
  { username: 'meyrem', email: 'meyrem@factory.local', name: 'Meyrem', password: 'Meyrem123', role: 'KIDEMLI_MUHENDIS' },
  { username: 'hasan', email: 'hasan@factory.local', name: 'Hasan', password: 'Hasan123', role: 'KIDEMLI_MUHENDIS' },
  // Yeni: Berke / Hasan / Meyrem için sahte üretim test hesapları
  { username: 'berke.kidemli', email: 'berke.kidemli@test.local', name: 'Berke', password: 'berke123', role: 'KIDEMLI_MUHENDIS' },
  { username: 'berke.saha', email: 'berke.saha@test.local', name: 'Berke (Saha)', password: 'berke123', role: 'SAHA_MUHENDISI' },
  { username: 'hasan.kidemli', email: 'hasan.kidemli@test.local', name: 'Hasan', password: 'hasan123', role: 'KIDEMLI_MUHENDIS' },
  { username: 'hasan.saha', email: 'hasan.saha@test.local', name: 'Hasan (Saha)', password: 'hasan123', role: 'SAHA_MUHENDISI' },
  { username: 'meyrem.kidemli', email: 'meyrem.kidemli@test.local', name: 'Meyrem', password: 'meyrem123', role: 'KIDEMLI_MUHENDIS' },
  { username: 'meyrem.saha', email: 'meyrem.saha@test.local', name: 'Meyrem (Saha)', password: 'meyrem123', role: 'SAHA_MUHENDISI' },
  // Bakımcı (2-3)
  { username: 'ali', email: 'ali@factory.local', name: 'Ali', password: 'Ali123', role: 'SAHA_MUHENDISI' },
  { username: 'veli', email: 'veli@factory.local', name: 'Veli', password: 'Veli123', role: 'SAHA_MUHENDISI' },
  { username: 'ayse', email: 'ayse@factory.local', name: 'Ayşe', password: 'Ayse123', role: 'SAHA_MUHENDISI' },
  // Teknisyen (5-6)
  { username: 'fatma', email: 'fatma@factory.local', name: 'Fatma', password: 'Fatma123', role: 'SAHA_MUHENDISI' },
  { username: 'ahmet', email: 'ahmet@factory.local', name: 'Ahmet', password: 'Ahmet123', role: 'SAHA_MUHENDISI' },
  { username: 'zeynep', email: 'zeynep@factory.local', name: 'Zeynep', password: 'Zeynep123', role: 'SAHA_MUHENDISI' },
  { username: 'mehmet', email: 'mehmet@factory.local', name: 'Mehmet', password: 'Mehmet123', role: 'SAHA_MUHENDISI' },
  { username: 'elif', email: 'elif@factory.local', name: 'Elif', password: 'Elif123', role: 'SAHA_MUHENDISI' },
];

async function seedUsers() {
  // Eski seed kullanıcılarını temizle (yeni listeyle çakışmasın)
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['admin@factory.local', 'kidemli@factory.local', 'saha@factory.local'],
      },
    },
  });

  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      create: {
        username: u.username,
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
      },
      update: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
      },
    });
  }
  console.log('Kullanıcılar seed edildi.');
}

async function main() {
  await seedUsers();

  const existing = await prisma.machine.count();
  if (existing > 0) {
    console.log('Makineler zaten mevcut, atlanıyor.');
    return;
  }

  const m1 = await prisma.machine.create({
    data: {
      name: 'SACMI PH7200',
      type: 'hydraulic',
      location: 'Pres Hattı 1 - Bozüyük',
      isActive: true,
    },
  });
  await prisma.machine.create({
    data: {
      name: 'SACMI PH8200',
      type: 'hydraulic',
      location: 'Pres Hattı 1 - Bozüyük',
      isActive: true,
    },
  });
  await prisma.machine.create({
    data: {
      name: 'System Ceramics SC-9000',
      type: 'hydraulic',
      location: 'Pres Hattı 2 - Bozüyük',
      isActive: true,
    },
  });

  const fc1 = await prisma.faultCode.create({
    data: {
      code: 'E101',
      title: 'Aşırı sıcaklık',
      description: 'Motor veya rulman aşırı ısınması.',
      severity: 'HIGH',
      category: 'thermal',
      responsibleRole: 'electrical_maintenance',
    },
  });
  const fc2 = await prisma.faultCode.create({
    data: {
      code: 'E102',
      title: 'Basınç düşüşü',
      description: 'Hidrolik basınç eşiğin altında.',
      severity: 'CRITICAL',
      category: 'pressure',
      responsibleRole: 'hydraulic_maintenance',
    },
  });
  const fc3 = await prisma.faultCode.create({
    data: {
      code: 'E103',
      title: 'Periyodik bakım hatırlatması',
      description: 'Makine periyodik bakım zamanı geldi.',
      severity: 'INFO',
      category: 'maintenance',
      responsibleRole: 'periodic_maintenance',
    },
  });

  await prisma.faultResolution.createMany({
    data: [
      {
        faultCodeId: fc1.id,
        stepOrder: 1,
        title: 'Güç kaynağını kapat',
        description: 'Makineyi güvenli şekilde durdurun.',
        toolsRequired: ['7\'lik anahtar', 'yankeski'],
        estimatedMinutes: 5,
      },
      {
        faultCodeId: fc1.id,
        stepOrder: 2,
        title: 'Soğutma ve kontrol',
        description: 'Soğutma sonrası sensörleri kontrol edin.',
        toolsRequired: ['tel', 'multimetre'],
        estimatedMinutes: 15,
      },
    ],
  });

  await prisma.alert.create({
    data: {
      machineId: m1.id,
      faultCodeId: fc1.id,
      severity: 'HIGH',
      message: 'E101: Aşırı sıcaklık tespit edildi.',
      status: 'OPEN',
    },
  });

  console.log('Seed OK.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
