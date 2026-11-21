import { Router } from 'express';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

const scrypt = promisify(scryptCallback);
const expirationSeconds = (value: string) => {
  const parsed = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!parsed) return 3600;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[parsed[2] as 's' | 'm' | 'h' | 'd'];
  return Number(parsed[1]) * unit;
};
const registerSchema = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254), password: z.string().min(8).max(128), role: z.enum(['CANDIDATE', 'RECRUITER']), skills: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]) });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const router = Router();

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

router.post('/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the registration fields.', details: parsed.error.flatten() } });
  const { name, email, password, role, skills } = parsed.data;
  try {
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email: normalizedEmail, passwordHash, role, skills: role === 'CANDIDATE' ? skills : [] }, select: { id: true, name: true, email: true, role: true, skills: true } });
    return res.status(201).json(user);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a valid email and password.' } });
  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    const accessToken = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return res.json({ accessToken, tokenType: 'Bearer', expiresIn: expirationSeconds(env.JWT_EXPIRES_IN), user: { id: user.id, name: user.name, email: user.email, role: user.role, skills: user.skills } });
  } catch (error) { return next(error); }
});

export const authRouter = router;
