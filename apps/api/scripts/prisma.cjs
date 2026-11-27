const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const apiDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiDir, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
// Docker PostgreSQL uses one connection for application queries and migrations.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const hostname = new URL(process.env.DATABASE_URL).hostname;
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const prismaCli = require.resolve('prisma/build/index.js', { paths: [apiDir] });
const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: apiDir,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
