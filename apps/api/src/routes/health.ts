import { Router } from 'express';
import { prisma } from '../config/database.js';
export const healthRouter = Router();
healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', service: 'kaushalconnect-api', database: 'ok' });
  } catch {
    return res.status(503).json({ status: 'degraded', service: 'kaushalconnect-api', database: 'unavailable' });
  }
});
