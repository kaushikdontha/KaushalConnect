# Demo checklist

1. Start local PostgreSQL and Redis with `npm run infra:up` (Docker Desktop must be running).
2. Configure `.env`, install dependencies, run `npm run db:generate` and `npm run db:deploy`.
3. Start `npm run dev` and `npm run worker` in separate terminals.
4. Register a recruiter and create a future-dated job requiring React, TypeScript, Redis, Docker.
5. Register a candidate with React and TypeScript; open the job and show the 50% preview.
6. Apply with a cover note. Confirm the application appears in the candidate dashboard and duplicate submission is disabled.
7. Sign in as the recruiter, open applicants, review the cover note and score, and shortlist the candidate.
8. Confirm decision feedback. Candidate dashboard refreshes within 15 seconds; verify both the final status and the notification.
9. Confirm final decisions have no further decision controls. A second recruiter's API request to the job's applicant list must return 403.
10. Edit candidate skills and verify the next job's preview uses them. Existing application scores remain snapshots.
11. Run `npm test` to exercise duplicate races, authorization, outage handling, retry persistence, and notification deduplication.

For an outage demonstration, stop local Redis before a new decision: the decision remains saved, the UI reports the notification failure, and the candidate sees the final status. Restart Redis afterwards. An event that was never enqueued is not retried automatically.
