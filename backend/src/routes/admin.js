import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireRole(['ADMIN']));

// Tüm kullanıcıları listele
adminRouter.get('/users', async (req, res) => {
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
    console.error('admin/users list error:', e);
    return res.status(500).json({ error: 'Kullanıcılar listelenirken hata oluştu.' });
  }
});

// Yeni kullanıcı oluştur
adminRouter.post('/users', async (req, res) => {
  try {
    const { username, email, name, password, role } = req.body || {};

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Kullanıcı adı zorunludur.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'E-posta zorunludur.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Ad soyad zorunludur.' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: 'Geçersiz rol seçimi.' });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (existingUsername) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existingEmail) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        name: name.trim(),
        passwordHash,
        role: normalizedRole,
      },
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

    return res.status(201).json(user);
  } catch (e) {
    console.error('admin/users create error:', e);
    return res.status(500).json({ error: 'Kullanıcı oluşturulurken hata oluştu.' });
  }
});

// Kullanıcı güncelle
adminRouter.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, name, password, role, isActive } = req.body || {};

    const data = {};
    if (username !== undefined) {
      const trimmed = String(username).trim().toLowerCase();
      if (!trimmed) {
        return res.status(400).json({ error: 'Kullanıcı adı boş olamaz.' });
      }
      const existing = await prisma.user.findFirst({
        where: { username: trimmed, NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
      }
      data.username = trimmed;
    }
    if (email !== undefined) {
      const trimmed = String(email).trim().toLowerCase();
      if (!trimmed) {
        return res.status(400).json({ error: 'E-posta boş olamaz.' });
      }
      const existing = await prisma.user.findFirst({
        where: { email: trimmed, NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı.' });
      }
      data.email = trimmed;
    }
    if (name !== undefined) data.name = String(name).trim();
    if (role !== undefined) {
      const r = normalizeRole(role);
      if (r) data.role = r;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (password !== undefined && password.length > 0) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
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

    return res.json(user);
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    console.error('admin/users update error:', e);
    return res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu.' });
  }
});

// Kullanıcı sil
adminRouter.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    }

    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    console.error('admin/users delete error:', e);
    return res.status(500).json({ error: 'Kullanıcı silinirken hata oluştu.' });
  }
});

function normalizeRole(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'KIDEMLI_MUHENDIS') return 'KIDEMLI_MUHENDIS';
  if (r === 'SAHA_MUHENDIS' || r === 'SAHA_MUHENDISI') return 'SAHA_MUHENDISI';
  return null;
}
