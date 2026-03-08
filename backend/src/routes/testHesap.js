import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isTestHesapTokenValid } from './auth.js';

export const testHesapRouter = Router();

function requireTestHesapToken(req, res, next) {
  const token = req.headers['x-test-hesap-token'];
  if (!isTestHesapTokenValid(token)) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş sayfa erişimi. Lütfen sayfa şifresini tekrar girin.' });
  }
  next();
}

testHesapRouter.use(requireTestHesapToken);

testHesapRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    return res.json(users);
  } catch (e) {
    console.error('test-hesap users list error:', e);
    return res.status(500).json({ error: 'Kullanıcılar listelenirken hata oluştu.' });
  }
});
