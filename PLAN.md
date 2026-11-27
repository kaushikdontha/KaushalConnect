# KaushalConnect — Detailed Project Plan

**Project:** Intelligent Employment & Skilling Platform  
**Format:** 5-hour software engineering hackathon practice  
**Role alignment:** Full-stack Software Engineer, Product & Delivery  
**Status:** Planning specification; not an implemented application

## 1. Executive summary

Build a working recruitment platform for candidates and recruiters. Candidates register, maintain skills, browse jobs, apply, and track status. Recruiters publish jobs, review applicants, and shortlist or reject applications. The system computes a deterministic skill-match score and asynchronously records notifications after status changes.

**Success criterion:** Demonstrate a complete recruiter → job → candidate → application → recruiter decision → candidate notification workflow, with persistent data and authorization checks.

### Scope priorities

- **P0 — Must ship:** registration/login, role-based authorization, job creation/listing, candidate applications, duplicate protection, application status updates, matching, functional frontend.
- **P1 — Aim to ship:** Redis/BullMQ notification worker, robust validation/error handling, pagination, structured logging, integration tests.
- **P2 — Stretch:** LLM explanations, Redis job-list cache, Kafka event prototype, AWS deployment design, advanced UI polish.

Avoid adding Kafka, AWS deployment, or LLM calls before the P0 workflow is demonstrably working.

## 2. Problem statement and actors

A government employment programme needs a reliable way to connect job seekers to openings. Candidates lack visibility into relevant roles and their application progress. Recruiters need structured vacancy management and a consistent applicant-review workflow.

**Actors:**

| Actor | Goals | Permissions |
|---|---|---|
| Candidate | Find and apply to suitable jobs; monitor outcomes | Read public jobs, create own applications, read own applications and notifications |
| Recruiter | Publish openings and review candidates | Create/read own jobs, read applications to own jobs, decide on applications |
| Background worker | Process queued status notifications | Service-only access to queue and notification persistence |

Admin approval and recruiter identity verification are outside the five-hour MVP. In a real government system, recruiter access should require verification rather than self-selected registration alone.

## 3. User stories and acceptance criteria

### US-01 Register and authenticate (P0)

As a candidate or recruiter, I can register and log in.

- Required registration fields: name, email, password, role; candidate skills may be empty.
- Normalize email to lowercase and trim whitespace; uniqueness is enforced in the database.
- Passwords are securely hashed, never returned or logged.
- Login issues a signed, expiring JWT containing user ID and role.
- Invalid credentials return 401; duplicate email returns 409.
- Protected endpoints require a valid bearer token.

### US-02 Create and discover jobs (P0)

As a recruiter, I can publish jobs; as a candidate, I can browse them.

- Job fields: title, description, location, required skills, deadline.
- Only recruiters can create jobs; the authenticated recruiter becomes the owner.
- Public listing supports `search`, `location`, `page`, and `limit`.
- Expired jobs remain visible but cannot accept applications.
- Invalid deadlines and blank required fields are rejected.

### US-03 Apply to a job (P0)

As a candidate, I can apply once to an open job.

- Candidates can submit a cover note for a job.
- The API derives candidate ID from the JWT, not the request body.
- Each application starts in `APPLIED` and stores the calculated match score.
- Duplicate applications return 409, even under concurrent submissions.
- Expired jobs return 400; unknown jobs return 404.

### US-04 Review applications (P0)

As a recruiter, I can review applications to my jobs and make a decision.

- Recruiter can read applicants only for jobs they own.
- Allowed transitions: `APPLIED → SHORTLISTED` or `APPLIED → REJECTED`.
- Final states cannot be changed in the MVP.
- Unauthorized ownership access returns 403; invalid transitions return 400.
- Candidate sees their latest status.

### US-05 Match skills (P0)

As a candidate, I can see how my skills match a job.

- Compare skills case-insensitively after trimming whitespace.
- Deduplicate both lists.
- `score = round(100 * matchedRequired / uniqueRequired)`.
- If no skills are required, score is 100.
- Return matching and missing required skills in job-defined order.
- Use deterministic exact matching; synonyms are a stretch enhancement.

### US-06 Async notifications (P1)

As a candidate, I can see an in-app notification when a recruiter changes my application status.

- After successful status persistence, enqueue a BullMQ job.
- Worker creates a notification associated with the candidate and application.
- Worker retries transient failures; notification creation is idempotent.
- API never falsely reports a notification as queued if enqueue fails.
- A Redis outage does not roll back a committed status update; log and expose failure. Guaranteed eventual delivery would require a durable outbox, a stretch improvement.

## 4. Product workflows

### Candidate journey

1. Register as `CANDIDATE` with skills.
2. Log in and receive JWT.
3. Browse and filter job listings.
4. Open job details; review required skills and deadline.
5. Submit an application.
6. See computed match score, matched skills, and missing skills.
7. View application status and notifications.

### Recruiter journey

1. Register as `RECRUITER` and log in.
2. Create a job opening.
3. View jobs they own.
4. Open applicants for a selected job.
5. Review applicant skills and match score.
6. Shortlist or reject an application.
7. Verify the candidate's status and notification change.

### First vertical slice

**Recruiter creates job → PostgreSQL persists job → GET /jobs returns job → React displays it.** Build and verify this before expanding to the rest of the platform.

## 5. Technology decisions

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast local iteration and typed components |
| Routing | React Router | Candidate/recruiter page navigation |
| Server state | TanStack Query | Loading/error handling, caching, invalidation |
| Client state | React state; Zustand only if needed | Avoid unnecessary global state |
| Forms | React Hook Form + Zod | Typed validation and form errors |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) | Rapid accessible interface development |
| API | Node.js + Express + TypeScript | Straightforward REST architecture |
| Auth | JWT + bcryptjs | Stateless API auth and password hashing |
| Validation | Zod | Consistent request schemas |
| Database | PostgreSQL + Prisma | Relational constraints and migrations |
| Queue | Redis + BullMQ | Background notification jobs |
| Logging | Pino or equivalent structured JSON logger | Debugging and observability |
| Local infrastructure | Docker Compose | Repeatable Postgres/Redis setup |
| Tests | Vitest or Node test runner + Supertest | Matching logic and API contract tests |

Use Kafka, AWS EC2/S3/ECR, and LLM APIs only after core acceptance criteria pass. Do not install both Prisma and Drizzle unless comparison is explicitly required.

## 6. Architecture

```text
Browser (React + TS + Vite)
  ├─ Candidate pages
  ├─ Recruiter pages
  └─ TanStack Query + fetch/axios
            │ HTTPS/HTTP REST + Bearer JWT
            ▼
Express API (TypeScript)
  ├─ Auth middleware + role/ownership checks
  ├─ Zod validation
  ├─ Controllers / services
  ├─ Prisma database access ──────────► PostgreSQL
  └─ BullMQ producer ─────────────────► Redis
                                          │
                                          ▼
                                  BullMQ worker
                                          │
                                          ▼
                                Notification record
                                     (PostgreSQL)
```

The frontend never directly accesses PostgreSQL or Redis. The API enforces all authorization and data integrity rules.

## 7. Database schema specification

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | Required |
| email | String | Trimmed, lowercase, unique |
| passwordHash | String | Required, secret |
| role | Enum | `CANDIDATE`, `RECRUITER` |
| skills | String[] | Candidate skills; default empty |
| createdAt | Timestamp | Server generated |

### Job

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| recruiterId | UUID | FK → User.id |
| title | String | Required, nonblank |
| description | Text | Required |
| location | String | Required |
| requiredSkills | String[] | Default empty |
| deadline | Timestamp with timezone | Required; future at creation |
| createdAt | Timestamp | Server generated |

### Application

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| jobId | UUID | FK → Job.id |
| candidateId | UUID | FK → User.id |
| coverNote | Text | Optional, bounded length |
| matchScore | Integer | 0–100 |
| status | Enum | `APPLIED`, `SHORTLISTED`, `REJECTED` |
| createdAt | Timestamp | Server generated |
| updatedAt | Timestamp | Updated on decision |

**Constraint:** Unique `(jobId, candidateId)`; index both foreign keys. Enforce the candidate role in application service logic.

### Notification

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | FK → User.id |
| applicationId | UUID | FK → Application.id |
| eventKey | String | Unique idempotency key for a status change |
| message | String | Required |
| createdAt | Timestamp | Server generated |

**Indexes:** `Job(recruiterId)`, `Application(jobId)`, `Application(candidateId)`, `Notification(userId, createdAt)`; unique normalized user email and application pair. Choose explicit referential delete behavior (prefer restrict for records with history).

### Relationships

- One recruiter user has many jobs.
- One candidate user has many applications.
- One job has many applications.
- One user has many notifications.
- One application can have multiple notifications across distinct events.

## 8. REST API contract

**Base URL:** `http://localhost:3000/api`  
**Auth:** `Authorization: Bearer <JWT>`  
**Content type:** `application/json`

| Method | Endpoint | Access | Success |
|---|---|---|---|
| POST | `/auth/register` | Public | 201 |
| POST | `/auth/login` | Public | 200 |
| GET | `/jobs` | Public | 200 |
| GET | `/jobs/:id` | Public | 200 |
| GET | `/jobs/mine` | Recruiter | 200 |
| POST | `/jobs` | Recruiter | 201 |
| POST | `/jobs/:id/apply` | Candidate | 201 |
| GET | `/applications/me` | Candidate | 200 |
| GET | `/jobs/:id/applications` | Owning recruiter | 200 |
| PATCH | `/applications/:id/status` | Owning recruiter | 200 |
| GET | `/notifications/me` | Authenticated | 200 |

**Route ordering:** Register `/jobs/mine` before a dynamic `/jobs/:id` route when the routing implementation requires it.

### Sample requests and responses

**POST `/auth/register`**

```json
{
  "name": "Asha Rao",
  "email": "asha@example.com",
  "password": "SecurePass123!",
  "role": "CANDIDATE",
  "skills": ["React", "TypeScript", "Node.js", "PostgreSQL"]
}
```

201:

```json
{
  "id": "<user-uuid>",
  "name": "Asha Rao",
  "email": "asha@example.com",
  "role": "CANDIDATE",
  "skills": ["React", "TypeScript", "Node.js", "PostgreSQL"]
}
```

**POST `/auth/login`**

```json
{"email":"asha@example.com","password":"SecurePass123!"}
```

200:

```json
{"accessToken":"<signed-jwt>","tokenType":"Bearer","expiresIn":3600}
```

**POST `/jobs`**

```json
{
  "title": "Junior Full Stack Engineer",
  "description": "Build and maintain employment applications.",
  "location": "Hyderabad",
  "requiredSkills": ["React", "TypeScript", "Redis", "Docker"],
  "deadline": "2026-12-15T23:59:59Z"
}
```

201: Job object with generated ID, authenticated `recruiterId`, and timestamps.

**GET `/jobs?search=engineer&location=Hyderabad&page=1&limit=10`**

200:

```json
{
  "data": [{"id":"<job-uuid>","title":"Junior Full Stack Engineer","location":"Hyderabad","requiredSkills":["React","TypeScript","Redis","Docker"],"deadline":"2026-12-15T23:59:59Z"}],
  "pagination": {"page":1,"limit":10,"total":1}
}
```

**POST `/jobs/:id/apply`**

```json
{"coverNote":"I have built React and TypeScript applications."}
```

201:

```json
{
  "id":"<application-uuid>",
  "jobId":"<job-uuid>",
  "status":"APPLIED",
  "matchScore":50,
  "matchingSkills":["React","TypeScript"],
  "missingSkills":["Redis","Docker"]
}
```

**PATCH `/applications/:id/status`**

```json
{"status":"SHORTLISTED"}
```

200:

```json
{"id":"<application-uuid>","status":"SHORTLISTED","notificationStatus":"QUEUED"}
```

Only return `QUEUED` after successful enqueue. If enqueue fails after status persistence, return an accurate failure status and log it; durable retry is an optional enhancement.

### Standard error response

```json
{"error":{"code":"DUPLICATE_APPLICATION","message":"You have already applied for this job."}}
```

| Status | Meaning |
|---|---|
| 400 | Validation failure, expired job, invalid transition |
| 401 | Missing/invalid credentials |
| 403 | Authenticated but not permitted |
| 404 | Resource not found |
| 409 | Duplicate email or application |
| 500 | Unexpected server error |

## 9. Frontend screen specification

### Authentication screen

- Registration form: name, email, password, role, candidate skills.
- Login form: email and password.
- Field validation, submit loading state, error banner.
- Redirect to role-appropriate dashboard after login.

### Job listings

- Search input, location filter, paginated job cards.
- Title, location, required skills, deadline, expiry indication.
- Loading skeleton, no-results state, API-error state.

### Job details

- Full description, required skills, deadline, candidate match preview.
- Apply form with cover note.
- Disable or reject apply for expired jobs and duplicate applications.

### Candidate dashboard

- Application list with job title, status, match score, submission date.
- Notifications feed.

### Recruiter dashboard

- Create-job form.
- Own jobs list.
- Applicant table per job with candidate details, match score, status, shortlist/reject controls.
- Explicit success and error feedback.

Use React Router for navigation, TanStack Query for server state and invalidation, React Hook Form + Zod for form validation, Tailwind/shadcn for accessible responsive UI. Prefer simple local state over introducing Zustand unnecessarily.

## 10. Suggested repository structure

```text
KaushalConnect/
├── README.md
├── PLAN.md
├── .gitignore
├── docker-compose.yml
├── client/
│   ├── .env.example
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── JobsPage.tsx
│       │   ├── JobDetailsPage.tsx
│       │   ├── CandidateDashboard.tsx
│       │   └── RecruiterDashboard.tsx
│       ├── components/
│       │   ├── ui/
│       │   └── jobs/
│       ├── features/
│       │   ├── auth/
│       │   ├── jobs/
│       │   └── applications/
│       ├── lib/
│       │   ├── api.ts
│       │   └── queryClient.ts
│       └── types/
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── config/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── middleware/
│       ├── validators/
│       ├── lib/
│       │   ├── prisma.ts
│       │   └── logger.ts
│       ├── queues/
│       │   └── notifications.ts
│       ├── workers/
│       │   └── notificationWorker.ts
│       ├── utils/
│       │   └── skillMatch.ts
│       └── tests/
└── docs/
    ├── api.md
    └── demo-checklist.md
```

This is a target structure; create files when needed rather than populating empty abstractions.

## 11. Five-hour implementation plan

| Time | Deliverable | Exit condition |
|---|---|---|
| 00:00–00:20 | Requirements and architecture | User flows, schema, API list agreed |
| 00:20–00:45 | Scaffold and infrastructure | Client/server boot; PostgreSQL accessible; migration succeeds |
| 00:45–01:30 | Authentication and jobs | Register/login and create/list jobs work in API client |
| 01:30–02:20 | Applications and matching | Candidate can apply; score computed; duplicates rejected |
| 02:20–03:30 | React screens and integration | Complete candidate/recruiter primary workflow in browser |
| 03:30–04:10 | Recruiter decisions and queue | Status change works; notification worker processes events |
| 04:10–04:40 | Tests and bug fixing | Critical permissions/validation tests pass |
| 04:40–05:00 | README and demo | Clean startup instructions and rehearsed end-to-end demo |

**Time-box rule:** If blocked for more than 15 minutes, reduce scope while preserving the core user journey. Do not sacrifice authentication/authorization or database integrity to polish the UI.

## 12. Implementation milestones and definition of done

### Milestone A — Bootable skeleton

- Client and server start locally.
- Database and Redis start through Docker Compose or existing local services.
- Environment examples are documented.
- Health endpoint responds.

### Milestone B — Authenticated job listing

- Recruiter can register/login/create job.
- Job persists in PostgreSQL.
- Candidate sees job in React.
- Unauthorized job creation returns 403.

### Milestone C — Complete application flow

- Candidate applies.
- Match score is deterministic and correct.
- Recruiter sees applicant.
- Duplicate submission returns 409.

### Milestone D — Decision and notification

- Recruiter shortlists/rejects own applicants.
- Candidate sees changed status.
- Worker creates an in-app notification; retry behavior is tested.

### Milestone E — Submission quality

- Critical edge cases pass.
- README includes exact startup steps.
- No secrets in Git.
- Demo runs without manual database changes.

## 13. Test fixtures

Create two recruiters and two candidates:

| Fixture | Email | Role | Skills |
|---|---|---|---|
| Recruiter 1 | recruiter1@test.com | RECRUITER | — |
| Recruiter 2 | recruiter2@test.com | RECRUITER | — |
| Candidate 1 | candidate1@test.com | CANDIDATE | React, TypeScript, Node.js, PostgreSQL |
| Candidate 2 | candidate2@test.com | CANDIDATE | Python, Docker, Redis, AWS |

Create three jobs:

| Job | Required skills | Deadline | Owner |
|---|---|---|---|
| A | React, TypeScript, Redis, Docker | 2026-12-15 | Recruiter 1 |
| B | Python, Docker, AWS | 2026-12-20 | Recruiter 2 |
| C | React, TypeScript | 2026-11-19 (expired) | Recruiter 1 |

**Expected scores:**

| Candidate | A | B | C |
|---|---:|---:|---:|
| Candidate 1 | 50% | 0% | 100% |
| Candidate 2 | 50% | 100% | 0% |

These fixtures assume the practice date is before the future job deadlines. For later reruns, generate future deadlines relative to the test clock or freeze time in tests.

## 14. Test and edge-case checklist

### Authentication

- [ ] Registration succeeds with valid data.
- [ ] Duplicate email (including different case) returns 409.
- [ ] Incorrect password returns 401.
- [ ] Invalid/missing JWT returns 401.
- [ ] Password hashes and tokens are absent from logs and API responses.

### Authorization

- [ ] Candidate cannot create jobs (403).
- [ ] Recruiter cannot apply (403).
- [ ] Recruiter 2 cannot view or update Recruiter 1's applicants (403).
- [ ] Candidate cannot read another candidate's applications.

### Job and application integrity

- [ ] Empty title is rejected.
- [ ] Expired job cannot accept applications.
- [ ] Unknown job returns 404.
- [ ] First application returns 201.
- [ ] Duplicate application returns 409.
- [ ] Concurrent duplicate submissions create at most one record.
- [ ] Invalid status transition is rejected.
- [ ] Application records persist across server restart.

### Matching

- [ ] Case-insensitive comparison.
- [ ] Trimming and deduplication.
- [ ] No required skills produces 100%.
- [ ] No matching skills produces 0%.
- [ ] Score remains in 0–100 range.

### Background processing

- [ ] Status change enqueues a job.
- [ ] Worker writes notification.
- [ ] Retry does not create duplicate notification.
- [ ] Redis outage is surfaced and logged accurately.

### Frontend

- [ ] Forms show validation errors.
- [ ] API loading, empty, and failure states are visible.
- [ ] Protected navigation handles logged-out users.
- [ ] Successful mutations refresh the relevant lists.

## 15. Failure handling and trade-offs

| Failure | Expected behavior |
|---|---|
| PostgreSQL unavailable | API returns controlled 500/503; log internal details; do not leak credentials |
| Redis unavailable | Status update remains persisted; report queue failure; document missing durable retry if no outbox |
| Duplicate application race | Database uniqueness guarantees one record; API maps conflict to 409 |
| Worker processes same event twice | Idempotency key / unique notification event prevents duplicates |
| Invalid JWT | 401 before business logic |
| Wrong recruiter | 403 before revealing applicant details |
| Frontend loses network | Show retryable error, do not claim success |

## 16. Evaluation rubric (practice only)

| Category | Points |
|---|---:|
| End-to-end functional workflow | 25 |
| Authentication and authorization | 15 |
| Database design and integrity | 15 |
| Frontend integration and usability | 15 |
| Skill matching correctness | 10 |
| Queue processing and failure handling | 10 |
| Code quality and tests | 5 |
| Documentation and demo | 5 |
| **Total** | **100** |

**Scoring guidance:** 90–100 excellent; 75–89 strong; 60–74 partial but promising; below 60 incomplete. These are mock evaluator bands, not official AlgoHire criteria.

## 17. Demo script (5 minutes)

1. Start infrastructure, API, worker, and frontend from documented commands.
2. Register/log in as Recruiter 1.
3. Create Job A.
4. Register/log in as Candidate 1 and apply to Job A.
5. Show 50% match, matching React/TypeScript, missing Redis/Docker.
6. Attempt duplicate application and show 409.
7. Log in as Recruiter 1; view applicant and shortlist.
8. Show Candidate 1's status update and notification.
9. Attempt an unauthorized recruiter action and show 403.
10. Explain database uniqueness, role ownership, queue failure behavior, and remaining trade-offs.

## 18. What to explain to evaluators

- Why `Application` is a join entity rather than storing applicants in a JSON field on `Job`.
- Why the unique `(jobId, candidateId)` constraint is essential under concurrency.
- How the authenticated JWT identity controls ownership and authorization.
- Why the match score is deterministic instead of delegated to an LLM.
- Why BullMQ is useful for notifications and what happens during Redis failure.
- Which indexes support the main queries.
- What you would change for a large government-scale deployment (outbox, monitoring, pagination, rate limits, infrastructure separation).

## 19. Start-building instructions for an AI coding assistant

1. Inspect workspace permissions and available terminal tools. Never claim commands succeeded without running them.
2. Read this plan and summarize the P0 workflow and architecture.
3. Propose the Prisma models and API contracts before implementation.
4. Scaffold frontend/backend and install dependencies only with available write/terminal access.
5. Build the first vertical slice: recruiter creates a job, database saves it, React lists it.
6. Add authentication, applications, matching, and decisions incrementally.
7. Add notifications only after the primary flow works.
8. Run tests and report exact passes, failures, and blockers.
9. Update README and mark unfinished work explicitly.

**Final principle:** A verified, secure, end-to-end MVP is more valuable than an incomplete showcase of every listed technology.
