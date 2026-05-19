import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getUserById, publicUser } from '../services/storage';
import { PublicUser } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

type TokenPayload = {
  userId: string;
};

function getBearerToken(req: Request) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length);
}

export function signToken(userId: string) {
  return jwt.sign({ userId } satisfies TokenPayload, env.jwtSecret, { expiresIn: '8h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Missing authentication token.' });
    }

    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    const user = getUserById(payload.userId);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ ok: false, message: 'User is not active or does not exist.' });
    }

    req.user = publicUser(user);
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Admin access is required.' });
  }

  return next();
}
