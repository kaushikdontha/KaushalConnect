import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export default defineConfig({ envDir: repoRoot, plugins: [react(), tailwindcss()], server: { port: 5173 } });
