import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
const server = app.listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'API listening'));
const shutdown = (signal: string) => { logger.info({ signal }, 'Shutting down API'); server.close(() => { void import('./config/database.js').then(({ prisma }) => prisma.$disconnect()).finally(() => process.exit(0)); }); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
