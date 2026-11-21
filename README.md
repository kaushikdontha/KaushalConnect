# KaushalConnect

Employment and skilling platform connecting candidates and recruiters, with registration, sign-in, job search, job creation, applications, and skill matching.

## Stack

- React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui-compatible setup, React Hook Form, Zod
- Node.js, Express, TypeScript, Prisma, PostgreSQL
- Redis and BullMQ worker
- Docker Compose for local PostgreSQL and Redis

## Requirements

Node.js 22.18 or newer (Node 24 recommended), npm 10 or newer, and PostgreSQL. Docker Desktop with Compose can run PostgreSQL and Redis locally.

## Setup

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random value.
2. Start PostgreSQL and Redis: `npm run infra:up`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npm run db:generate`.
5. Apply the initial schema: `npm run db:migrate`.
6. Start API and web app: `npm run dev`.
7. Start the queue worker in another terminal: `npm run worker`.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Sample jobs

Run `npm run db:seed:demo` after applying migrations to save 100 fictional jobs. Repeated runs preserve existing records and applications. The seed recruiter has a random password that is not retained. Local development can show sample listings when the API is unavailable; production displays an error instead.

## Publishing and hosting

Before publishing source to GitHub, run `npm run db:generate`, `npm run build`, and `npm run typecheck`. Keep `.env` private; `.env.example` documents the required settings. Database records are not included in GitHub: migrate and seed the target database separately.

GitHub hosts the source repository. The full application also needs a Node API host and PostgreSQL; GitHub Pages cannot run the API. For Vercel frontend hosting, set the project root to `apps/web`, build with `npm run build`, and use `dist` as output. Set `VITE_API_URL` to the deployed API URL ending in `/api` before building. Configure `WEB_ORIGIN` on the API to the frontend HTTPS origin, `NODE_ENV=production`, database connection strings, and a unique random `JWT_SECRET`. Run `npm run db:deploy` against the target database before starting the API. Start the compiled API with `npm --workspace @kaushalconnect/api start`.

The queue worker currently only logs notifications; notification delivery is not implemented. Before exposing authentication publicly, add request rate limiting and account recovery appropriate to your hosting environment.

Web: http://localhost:5173 · API health: http://localhost:4000/health
