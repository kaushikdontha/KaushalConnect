# API contract

Base path: `/api`. Protected requests use `Authorization: Bearer <JWT>`. JSON errors have `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/register` | Public; name, email, password, role, optional skills |
| POST | `/auth/login` | Public; email and password |
| GET | `/users/me` | Authenticated; public account fields only |
| PATCH | `/users/me` | Candidate; `{ "skills": ["React"] }` |
| GET | `/jobs?search=&location=&page=1&limit=10` | Public; `{ data, pagination: { page, limit, total } }` |
| GET | `/jobs/:id` | Public |
| GET | `/jobs/mine` | Recruiter |
| POST | `/jobs` | Recruiter; title, description, location, requiredSkills, deadline |
| POST | `/jobs/:id/apply` | Candidate; optional coverNote, maximum 2000 characters |
| GET | `/applications/me` | Candidate; own records |
| GET | `/jobs/:id/applications` | Owning recruiter; includes safe candidate fields |
| PATCH | `/applications/:id/status` | Owning recruiter; `{ "status": "SHORTLISTED" }` or `REJECTED` |
| GET | `/notifications/me` | Authenticated; latest 100 own notifications |

A decision is accepted only while the application is `APPLIED`. Concurrent decisions are guarded by a conditional database update. A successful decision returns `{ id, status, notificationStatus: "QUEUED" | "FAILED" }`. `FAILED` refers to notification enqueueing; the decision is already saved. Repeating a final decision returns 400.

Validation errors: 400; missing/invalid credentials: 401; wrong role/owner: 403; missing resource: 404; duplicate email/application: 409; unavailable database: 503 when initialization fails; unexpected errors: 500.

`GET /health` queries PostgreSQL and returns 200 for a healthy database or 503 for an unavailable database. It does not check Redis or worker activity.
