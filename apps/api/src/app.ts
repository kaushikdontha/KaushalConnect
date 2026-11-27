import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';
import pinoHttpModule from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { jobsRouter } from './routes/jobs.js';
import { applicationsRouter } from './routes/applications.js';
import { profileRouter } from './routes/profile.js';
export const app = express();
const pinoHttp = pinoHttpModule as unknown as (options: { logger: typeof logger }) => express.RequestHandler;
app.disable('x-powered-by'); app.use(helmet()); app.use(cors({ origin: env.WEB_ORIGIN })); app.use(express.json({ limit: '1mb' })); app.use(pinoHttp({ logger }));
app.get('/', (_req, res) => res.json({ service: 'kaushalconnect-api', health: '/health', api: '/api' }));
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api', applicationsRouter);
app.use('/api/users', profileRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ error }, 'Database is unavailable');
    return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is unavailable. Start PostgreSQL and try again.' } });
  }
  logger.error({ error }, 'Unhandled request error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
