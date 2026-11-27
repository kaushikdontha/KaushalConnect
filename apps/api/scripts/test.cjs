const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('Tests require a local PostgreSQL DATABASE_URL and REDIS_URL.');
const url = new URL(process.env.DATABASE_URL);
const redis = new URL(process.env.REDIS_URL);
if (![url.hostname, redis.hostname].every(h => ['localhost', '127.0.0.1', '[::1]'].includes(h))) throw new Error('Integration tests require local services to protect hosted data.');
url.searchParams.set('schema', 'kc_test_' + randomUUID().replaceAll('-', ''));
process.env.DATABASE_URL = url.toString();
process.env.DIRECT_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.NOTIFICATION_QUEUE = 'test-' + randomUUID();
process.env.JWT_SECRET = randomUUID() + randomUUID();
process.env.LOG_LEVEL = 'silent';
const cwd = path.resolve(__dirname, '..');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  let code = 1;
  try {
    const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd, env: process.env, stdio: 'inherit' });
    if (migration.status !== 0) throw new Error('Test schema migration failed');
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/workflow.test.ts'], { cwd, env: process.env, stdio: 'inherit' });
    code = result.status ?? 1;
  } finally {
    const schema = url.searchParams.get('schema');
    if (!/^kc_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid cleanup schema');
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
  process.exitCode = code;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
