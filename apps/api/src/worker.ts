import { Worker } from 'bullmq';
import { redis } from './config/redis.js';
import { logger } from './config/logger.js';
const worker = new Worker('notifications', async (job) => { logger.info({ jobId: job.id, name: job.name }, 'Notification job received'); }, { connection: redis });
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Notification job completed'));
worker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Notification job failed'));
const shutdown = async () => { await worker.close(); await redis.quit(); process.exit(0); };
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
