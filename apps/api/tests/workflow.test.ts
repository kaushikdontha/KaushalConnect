import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { matchSkills } from '../src/utils/skillMatch.js';
import { recordDecision } from '../src/services/notifications.js';
import { enqueueDecision, eventKey } from '../src/services/queue.js';
import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';

test('matching normalizes, deduplicates, preserves order and handles empty requirements', () => {
  assert.deepEqual(matchSkills([' react ', 'REACT', 'TypeScript'], ['React', 'Redis', ' react ', 'Docker', 'TypeScript']), { matchScore: 50, matchingSkills: ['React', 'TypeScript'], missingSkills: ['Redis', 'Docker'] });
  assert.equal(matchSkills([], []).matchScore, 100);
  assert.equal(matchSkills([], ['Docker']).matchScore, 0);
  assert.equal(matchSkills(['Python', 'Docker', 'AWS'], ['Python', 'Docker', 'AWS']).matchScore, 100);
});

test('complete recruitment workflow and failure contracts', async t => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  async function call(path: string, token?: string, method = 'GET', data?: unknown) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json() };
  }
  const suffix = randomUUID();
  const password = 'Test password 123!';
  const fixtures: { id: string; token: string; email: string }[] = [];
  let worker: Worker | undefined;
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(env.NOTIFICATION_QUEUE, { connection });
  const jobIds: string[] = [];
  try {
    await t.test('registration, normalization, hashing, duplicate and invalid credentials', async () => {
      for (const [i, role] of ['RECRUITER', 'RECRUITER', 'CANDIDATE', 'CANDIDATE'].entries()) {
        const email = `user${i}-${suffix}@example.com`;
        const result = await call('/auth/register', undefined, 'POST', { name: `User ${i}`, email: ` ${email.toUpperCase()} `, password, role, skills: ['React', 'TypeScript'] });
        assert.equal(result.status, 201); assert.equal(result.body.email, email); assert.equal(result.body.passwordHash, undefined);
        const stored = await prisma.user.findUniqueOrThrow({ where: { id: result.body.id } });
        assert.notEqual(stored.passwordHash, password);
        const login = await call('/auth/login', undefined, 'POST', { email, password });
        assert.equal(login.status, 200); assert.ok(login.body.accessToken);
        fixtures.push({ id: result.body.id, token: login.body.accessToken, email });
      }
      assert.equal((await call('/auth/register', undefined, 'POST', { name: 'Duplicate', email: fixtures[0]!.email.toUpperCase(), password, role: 'RECRUITER' })).status, 409);
      assert.equal((await call('/auth/login', undefined, 'POST', { email: fixtures[0]!.email, password: 'wrong' })).status, 401);
    });
    const [r1, r2, c1, c2] = fixtures as [typeof fixtures[number], typeof fixtures[number], typeof fixtures[number], typeof fixtures[number]];
    const jobData = { title: 'Engineer', description: 'Build employment tools.', location: 'Hyderabad', requiredSkills: ['React', 'TypeScript', 'Redis', 'Docker'], deadline: new Date(Date.now() + 86400000).toISOString() };
    const job = await call('/jobs', r1.token, 'POST', jobData);
    assert.equal(job.status, 201);
    const jobId = job.body.id;
    await t.test('role, ownership, validation and pagination checks', async () => {
      assert.equal((await call('/jobs', undefined, 'POST', jobData)).status, 401);
      assert.equal((await call('/jobs', 'invalid', 'POST', jobData)).status, 401);
      assert.equal((await call('/jobs', c1.token, 'POST', jobData)).status, 403);
      assert.equal((await call('/jobs', r1.token, 'POST', { ...jobData, title: ' ' })).status, 400);
      assert.equal((await call('/jobs', r1.token, 'POST', { ...jobData, deadline: '2020-01-01T00:00:00Z' })).status, 400);
      assert.equal((await call(`/jobs/${jobId}/apply`, r1.token, 'POST', {})).status, 403);
      assert.equal((await call(`/jobs/${jobId}/applications`, r2.token)).status, 403);
      assert.equal((await call(`/jobs/${randomUUID()}/apply`, c1.token, 'POST', {})).status, 404);
      const listing = await call('/jobs?search=Engineer&location=Hyderabad&page=1&limit=1');
      assert.equal(listing.body.pagination.total, 1); assert.equal(listing.body.data.length, 1);
    });
    let applicationId = '';
    await t.test('concurrent duplicate submissions create one application with a 50% match', async () => {
      const results = await Promise.all([call(`/jobs/${jobId}/apply`, c1.token, 'POST', { coverNote: 'Interested' }), call(`/jobs/${jobId}/apply`, c1.token, 'POST', {})]);
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
      const created = results.find(r => r.status === 201)!;
      applicationId = created.body.id; assert.equal(created.body.matchScore, 50);
      assert.deepEqual(created.body.missingSkills, ['Redis', 'Docker']);
      assert.equal((await call('/applications/me', c2.token)).body.length, 0);
      await prisma.job.update({ where: { id: jobId }, data: { deadline: new Date(0) } });
      assert.equal((await call(`/jobs/${jobId}/apply`, c2.token, 'POST', {})).status, 400);
    });
    await t.test('skills can be maintained only by candidates', async () => {
      assert.equal((await call('/users/me', c1.token, 'PATCH', { skills: ['Python'] })).status, 200);
      assert.deepEqual((await call('/users/me', c1.token)).body.skills, ['Python']);
      assert.equal((await call('/users/me', r1.token, 'PATCH', { skills: [] })).status, 403);
    });
    await t.test('final decisions enforce ownership and expose Redis failure without rollback', async () => {
      const path = `/applications/${applicationId}/status`;
      assert.equal((await call(path, c1.token, 'PATCH', { status: 'SHORTLISTED' })).status, 403);
      assert.equal((await call(path, r2.token, 'PATCH', { status: 'SHORTLISTED' })).status, 403);
      assert.equal((await call(path, r1.token, 'PATCH', { status: 'APPLIED' })).status, 400);
      const original = env.REDIS_URL;
      env.REDIS_URL = 'redis://127.0.0.1:1';
      try {
        const result = await call(path, r1.token, 'PATCH', { status: 'SHORTLISTED' });
        assert.equal(result.status, 200); assert.equal(result.body.notificationStatus, 'FAILED');
      } finally { env.REDIS_URL = original; }
      assert.equal((await call('/applications/me', c1.token)).body[0].status, 'SHORTLISTED');
      assert.equal((await call(path, r1.token, 'PATCH', { status: 'REJECTED' })).status, 400);
    });
    await t.test('concurrent recruiter decisions commit and enqueue only one final decision', async () => {
      await prisma.job.update({ where: { id: jobId }, data: { deadline: new Date(Date.now() + 86400000) } });
      const applied = await call(`/jobs/${jobId}/apply`, c2.token, 'POST', {});
      assert.equal(applied.status, 201);
      const results = await Promise.all(['SHORTLISTED', 'REJECTED'].map(status => call(`/applications/${applied.body.id}/status`, r1.token, 'PATCH', { status })));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
      const winner = results.find(r => r.status === 200)!;
      assert.equal(winner.body.notificationStatus, 'QUEUED');
      const key = eventKey({ applicationId: applied.body.id, status: winner.body.status });
      jobIds.push(key);
      const queued = await queue.getJob(key);
      assert.ok(queued);
      // Isolate retry assertions below from this separately verified queue job.
      await queued.remove();
    });
    await t.test('queue retries transient processing failures and persistence is idempotent', async () => {
      let attempts = 0;
      worker = new Worker(env.NOTIFICATION_QUEUE, async job => {
        // Never process another application's jobs in the shared local Redis.
        assert.equal(job.data.applicationId, applicationId);
        if (++attempts === 1) throw new Error('Simulated transient database failure');
        await recordDecision(job.data);
      }, { connection });
      const event = { applicationId, status: 'SHORTLISTED' as const };
      jobIds.push(eventKey(event));
      await enqueueDecision(event);
      const deadline = Date.now() + 12000;
      while (!await prisma.notification.count({ where: { applicationId } })) {
        if (Date.now() > deadline) throw new Error('Worker did not persist notification before deadline');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(attempts >= 2);
      await recordDecision(event); await recordDecision(event);
      assert.equal(await prisma.notification.count({ where: { applicationId } }), 1);
      assert.equal((await call('/notifications/me', c1.token)).body.length, 1);
      assert.equal((await call('/notifications/me', c2.token)).body.length, 0);
    });
  } finally {
    await worker?.close();
    for (const id of jobIds) { const job = await queue.getJob(id); if (job) await job.remove(); }
    await queue.close(); await connection.quit();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
