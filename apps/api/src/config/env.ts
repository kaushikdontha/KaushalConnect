import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
loadEnv({ path: resolve(repoRoot, '.env') });
export const env = z.object({ NODE_ENV: z.enum(['development','test','production']).default('development'), API_PORT: z.coerce.number().int().positive().default(4000), WEB_ORIGIN: z.string().url().default('http://localhost:5173'), DATABASE_URL: z.string().min(1), REDIS_URL: z.string().url().default('redis://localhost:6379'), JWT_SECRET: z.string().min(32), JWT_EXPIRES_IN: z.string().default('1d'), LOG_LEVEL: z.string().default('info') }).parse(process.env);
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET === 'replace-with-a-long-random-secret-before-use') throw new Error('JWT_SECRET must be replaced before production startup.');
  if (new URL(env.WEB_ORIGIN).hostname === 'localhost') throw new Error('WEB_ORIGIN must be set to the deployed frontend origin in production.');
}
