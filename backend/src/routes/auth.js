import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

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

// Test hesap: Admin olarak başka hesaba hızlı geçiş (tek seferde bir hesap)
authRouter.post('/test-login', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Önce giriş yapmalısınız.' });
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
      return res.status(403).json({ error: 'Bu işlem sadece admin tarafından yapılabilir.' });
    }

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId zorunludur.' });
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

