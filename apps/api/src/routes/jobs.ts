import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';

const createJobSchema = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(10000), location: z.string().trim().min(1).max(160), requiredSkills: z.array(z.string().trim().min(1).max(80)).max(50).default([]), deadline: z.string().datetime({ offset: true }) });
const router = Router();

router.get('/mine', requireAuth, requireRole('RECRUITER'), async (req: AuthRequest, res, next) => {
  try { return res.json(await prisma.job.findMany({ where: { recruiterId: req.user!.id }, orderBy: { createdAt: 'desc' } })); }
  catch (error) { return next(error); }
});

router.get('/', async (req, res, next) => {
  const querySchema = z.object({ search: z.string().trim().max(160).optional(), location: z.string().trim().max(160).optional(), page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(10) });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid job listing filters.' } });
  const { search, location, page, limit } = parsed.data;
  const where = { ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { description: { contains: search, mode: 'insensitive' as const } }] } : {}), ...(location ? { location: { contains: location, mode: 'insensitive' as const } } : {}) };
  try {
    const [data, total] = await Promise.all([prisma.job.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }] }), prisma.job.count({ where })]);
    return res.json({ data, pagination: { page, limit, total } });
  } catch (error) { return next(error); }
});

router.post('/', requireAuth, requireRole('RECRUITER'), async (req: AuthRequest, res, next) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the job fields.', details: parsed.error.flatten() } });
  const deadline = new Date(parsed.data.deadline);
  if (deadline <= new Date()) return res.status(400).json({ error: { code: 'INVALID_DEADLINE', message: 'The deadline must be in the future.' } });
  try { return res.status(201).json(await prisma.job.create({ data: { ...parsed.data, deadline, recruiterId: req.user!.id } })); }
  catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Job ID must be a UUID.' } });
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } });
    return res.json(job);
  } catch (error) { return next(error); }
});

export const jobsRouter = router;
