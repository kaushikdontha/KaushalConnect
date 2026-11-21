import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthUser = { id: string; role: 'CANDIDATE' | 'RECRUITER' };
export type AuthRequest = Request & { user?: AuthUser };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required.' } });
  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || (payload.role !== 'CANDIDATE' && payload.role !== 'RECRUITER')) throw new Error('Invalid token payload');
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The bearer token is invalid or expired.' } });
  }
}

export function requireRole(role: AuthUser['role']) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } });
    if (req.user.role !== role) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
    return next();
  };
}
