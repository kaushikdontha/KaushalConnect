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

Run `npm run db:seed:demo` after applying migrations to save 100 fictional jobs. Repeated runs preserve existing records and applications. The seed recruiter has a random password that is not retained. The frontend displays an explicit API error if listings cannot be loaded. Run `npm run db:seed:fixtures` with `FIXTURE_PASSWORD` set (12+ characters) to create the four local practice accounts and Jobs A/B/C from the plan. This fixture command refuses hosted databases and updates the practice passwords on each run.

## Publishing and hosting

Before publishing source to GitHub, run `npm run db:generate`, `npm run build`, and `npm run typecheck`. Keep `.env` private; `.env.example` documents the required settings. Database records are not included in GitHub: migrate and seed the target database separately.

For Vercel, use the repository root as Root Directory. The root `vercel.json` builds both workspaces, generates Prisma Client, serves `apps/web/dist`, and routes `/api/*` to the Express function. Root runtime dependencies are declared explicitly so Vercel packages the backend dependencies. Keep their versions aligned with `apps/api/package.json`.

Set production environment variables: `VITE_API_URL=/api`, `WEB_ORIGIN` to the frontend HTTPS origin, `DATABASE_URL` to hosted PostgreSQL, `DIRECT_URL` to its direct connection for migrations, and a unique random `JWT_SECRET` of at least 32 characters. Run `npm run db:deploy` against that database before using registration. Localhost database URLs cannot work from Vercel. The queue worker needs a separate long-running host and Redis when notification delivery is enabled.

For a separate API host, set `VITE_API_URL` to that host's URL ending in `/api` and start the compiled API with `npm --workspace @kaushalconnect/api start`. GitHub Pages cannot run the API.

The queue worker persists candidate notifications after recruiter decisions. Start it separately with `npm run worker` locally or `npm --workspace @kaushalconnect/api run worker:prod` after building on a persistent Node host. Vercel hosts the HTTP API; it does not keep this worker running. Set a hosted `REDIS_URL` on both API and worker for production notifications. If Redis is unavailable, decisions remain saved and the recruiter sees a notification failure. Successfully enqueued jobs retry up to five times and database event keys prevent duplicate notifications.

Run `npm test` with local PostgreSQL and Redis running. It creates and removes an isolated schema and queue, and refuses hosted database URLs. Run `npm run build` and `npm run typecheck` for compilation checks. Apply all migrations with `npm run db:deploy` before releasing changes.

See [API contract](docs/api.md), [demo checklist](docs/demo-checklist.md), [implementation status](docs/implementation-status.md), and the [original plan](PLAN.md). Kafka, application caching, and AWS are excluded. LLM explanations are optional stretch work. Before exposing authentication publicly, add request rate limiting and account recovery appropriate to your hosting environment.

Web: http://localhost:5173 · API health: http://localhost:4000/health
