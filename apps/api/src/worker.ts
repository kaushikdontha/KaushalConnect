import { env } from './config/env.js';
import { Worker } from 'bullmq';
import { redis } from './config/redis.js';
import { logger } from './config/logger.js';
import { recordDecision } from './services/notifications.js';
import { prisma } from './config/database.js';
import { z } from 'zod';
const eventSchema = z.object({ applicationId: z.string().uuid(), status: z.enum(['SHORTLISTED', 'REJECTED']) });
const worker = new Worker(env.NOTIFICATION_QUEUE, async (job) => {
  if (job.name !== 'application-decision') throw new Error('Unknown notification event');
  await recordDecision(eventSchema.parse(job.data));
}, { connection: redis });
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Notification job completed'));
worker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Notification job failed'));
worker.on('error', () => logger.error('Notification worker connection failed; Redis retries are enabled'));
redis.on('error', () => logger.error('Worker Redis connection unavailable'));
const shutdown = async () => { await worker.close(); await redis.quit(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
