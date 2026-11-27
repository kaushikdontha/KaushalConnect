import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
export const profileRouter = Router();
const select = { id: true, name: true, email: true, role: true, skills: true } as const;
profileRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select });
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Account no longer exists.' } });
    return res.json(user);
  } catch (error) { return next(error); }
});
profileRouter.patch('/me', requireAuth, requireRole('CANDIDATE'), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ skills: z.array(z.string().trim().min(1).max(80)).max(50) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide up to 50 skills, each 1–80 characters.' } });
  try { return res.json(await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data, select })); }
  catch (error) { return next(error); }
});
