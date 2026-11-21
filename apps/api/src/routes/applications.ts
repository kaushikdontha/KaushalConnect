import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { matchSkills } from '../utils/skillMatch.js';

const router = Router();
const applicationSchema = z.object({ coverNote: z.string().trim().max(2000).optional().default('') });
const idSchema = z.string().uuid();

router.post('/jobs/:id/apply', requireAuth, requireRole('CANDIDATE'), async (req: AuthRequest, res, next) => {
  const jobId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!idSchema.safeParse(jobId).success) return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Job ID must be a UUID.' } });
  const parsed = applicationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cover note must be 2,000 characters or fewer.' } });
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } });
    if (job.deadline <= new Date()) return res.status(400).json({ error: { code: 'JOB_EXPIRED', message: 'This job is no longer accepting applications.' } });
    const candidate = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { skills: true } });
    if (!candidate) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Candidate account no longer exists.' } });
    const match = matchSkills(candidate.skills, job.requiredSkills);
    const application = await prisma.application.create({ data: { jobId: job.id, candidateId: req.user!.id, coverNote: parsed.data.coverNote, matchScore: match.matchScore } });
    return res.status(201).json({ id: application.id, jobId: application.jobId, status: application.status, matchScore: application.matchScore, matchingSkills: match.matchingSkills, missingSkills: match.missingSkills, createdAt: application.createdAt });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE_APPLICATION', message: 'You have already applied for this job.' } });
    return next(error);
  }
});

router.get('/applications/me', requireAuth, requireRole('CANDIDATE'), async (req: AuthRequest, res, next) => {
  try { return res.json(await prisma.application.findMany({ where: { candidateId: req.user!.id }, include: { job: { select: { id: true, title: true, location: true, deadline: true } } }, orderBy: { createdAt: 'desc' } })); }
  catch (error) { return next(error); }
});

router.get('/jobs/:id/applications', requireAuth, requireRole('RECRUITER'), async (req: AuthRequest, res, next) => {
  const jobId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!idSchema.safeParse(jobId).success) return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Job ID must be a UUID.' } });
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { recruiterId: true } });
    if (!job) return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } });
    if (job.recruiterId !== req.user!.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only review applicants for your own jobs.' } });
    return res.json(await prisma.application.findMany({ where: { jobId }, include: { candidate: { select: { id: true, name: true, email: true, skills: true } } }, orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }] }));
  } catch (error) { return next(error); }
});

export const applicationsRouter = router;
