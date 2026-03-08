import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// Test Hesaplar sayfası için geçici token'lar (şifre doğrulandığında verilir)
const TEST_HESAP_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
const testHesapTokens = new Map(); // token -> expiry timestamp

export function isTestHesapTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  const expiry = testHesapTokens.get(token);
  if (!expiry || Date.now() > expiry) {
    testHesapTokens.delete(token);
    return false;
  }
  return true;
}

// Test Hesaplar sayfası şifresi doğrula; .env'deki TEST_HESAP_PASSWORD ile karşılaştırır
authRouter.post('/verify-test-hesap', async (req, res) => {
  try {
    const envPassword = process.env.TEST_HESAP_PASSWORD;
    if (!envPassword || !envPassword.trim()) {
      return res.status(503).json({ error: 'Bu sayfa şu an kullanılamıyor. Lütfen yönetici ile iletişime geçin.' });
    }
    const { password } = req.body || {};
    if (password !== envPassword) {
      return res.status(401).json({ error: 'Geçersiz sayfa şifresi.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    testHesapTokens.set(token, Date.now() + TEST_HESAP_TOKEN_TTL_MS);
    return res.json({ token });
  } catch (e) {
    console.error('verify-test-hesap error:', e);
    return res.status(500).json({ error: 'Doğrulama sırasında hata oluştu.' });
  }
});

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Mevcut kullanıcı bilgisini döner
authRouter.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(200).json({ user: null });
    }
    const token = auth.slice('Bearer '.length);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(200).json({ user: null });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(200).json({ user: null });
    }
    return res.json({ user });
  } catch (e) {
    console.error('auth/me error:', e);
    return res.status(500).json({ error: 'Kullanıcı bilgisi alınırken hata oluştu.' });
  }
});

// Giriş (username veya email ile)
authRouter.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const loginId = username || email;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı/e-posta ve şifre zorunludur.' });
    }

    const isEmail = String(loginId).includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: loginId } : { username: loginId },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı veya şifre.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı veya şifre.' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
});

// Basit logout endpoint (istemci tarafında token silinir)
authRouter.post('/logout', (req, res) => {
  return res.status(204).send();
});

// Test hesap: Admin veya geçerli sayfa şifresi (X-Test-Hesap-Token) ile başka hesaba hızlı geçiş
authRouter.post('/test-login', async (req, res) => {
  try {
    const pageToken = req.headers['x-test-hesap-token'];
    const hasValidPageToken = isTestHesapTokenValid(pageToken);

    if (!hasValidPageToken) {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Önce giriş yapmalısınız veya sayfa şifresini girin.' });
      }
      const token = auth.slice('Bearer '.length);
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Oturum geçersiz.' });
      }
      const currentUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });
      if (!currentUser || currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Bu işlem sadece admin veya geçerli sayfa şifresi ile yapılabilir.' });
      }
    }

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'Geçersiz istek.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ error: 'Hedef kullanıcı bulunamadı veya pasif.' });
    }

    const newToken = signToken(targetUser);
    return res.json({
      token: newToken,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
      },
    });
  } catch (e) {
    console.error('test-login error:', e);
    return res.status(500).json({ error: 'Hızlı giriş sırasında hata oluştu.' });
  }
});

