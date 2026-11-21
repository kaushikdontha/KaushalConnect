const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const apiDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiDir, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

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
