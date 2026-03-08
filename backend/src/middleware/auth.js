import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekiyor.' });
    }
    const token = auth.slice('Bearer '.length);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Kullanıcı pasif veya bulunamadı.' });
    }

    req.user = user;
    next();
  } catch (e) {
    console.error('authMiddleware error:', e);
    return res.status(500).json({ error: 'Kimlik doğrulama sırasında hata oluştu.' });
  }
}

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekiyor.' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

