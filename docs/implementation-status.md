# Implementation status

The original specification is preserved in `PLAN.md`. Kafka, application caching, and AWS are excluded by the project owner. LLM explanations remain an optional stretch feature; skill matching is deterministic.

## Implemented

- Registration, case-normalized unique email, scrypt password hashing, signed expiring JWTs, role checks, and ownership checks. Scrypt preserves existing accounts and provides salted password hashing in place of the plan's suggested bcryptjs.
- Job creation, search/location filters, pagination, expiry checks, and recruiter job listings.
- Candidate skill maintenance through `GET/PATCH /api/users/me`.
- Applications with persisted skill scores, exact normalized matching, database duplicate protection, and matched/missing skills.
- Recruiter applicant review, cover notes, shortlist/reject decisions, atomic final-state transitions, and candidate status refresh.
- BullMQ notification producer with bounded connection attempts, five processing attempts with exponential backoff, and a worker that writes idempotent notification records.
- Candidate notification feed through `GET /api/notifications/me` (latest 100 records).
- React Router, TanStack Query request state and mutation invalidation, React Hook Form/Zod field validation, responsive screens, pending/error/empty states, and session clearing after authenticated 401 responses.
- Schema migrations, timestamp timezone types, history-preserving foreign keys, and unique notification event keys.
- Local integration suite using a temporary PostgreSQL schema and a unique Redis queue. Hosted databases are explicitly rejected by the test runner.

## Runtime requirements

The Vercel function handles HTTP requests. Run `npm --workspace @kaushalconnect/api run worker:prod` on a separate persistent Node host with the same hosted PostgreSQL and Redis configuration. Docker Redis on a developer computer cannot be reached through `localhost` from Vercel. A successful enqueue means the notification is waiting for the worker; it does not claim delivery has completed.

If Redis enqueue fails, the committed decision returns HTTP 200 with `notificationStatus: FAILED`; the recruiter UI displays this condition. The application is not rolled back. There is no durable outbox or automatic recovery for an event that never reached Redis. The worker retries failures for events successfully enqueued. Final decisions cannot be edited in this MVP.

## Verification and remaining deployment work

Use `npm test`, `npm run build`, and `npm run typecheck`. The suite tests real local PostgreSQL/Redis and HTTP endpoints. Browser interaction and production worker deployment require separate verification; compilation alone does not verify them.

Apply the new migration with `npm run db:deploy` against the intended environment before deploying this version. Do not copy local database settings into production. This feature work does not automatically publish or migrate the live service.
