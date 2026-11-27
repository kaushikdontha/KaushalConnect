import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';

if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname)) throw new Error('Practice fixtures may only be seeded into local PostgreSQL.');
const password = process.env.FIXTURE_PASSWORD;
if (!password || password.length < 12) throw new Error('Set FIXTURE_PASSWORD to at least 12 characters for the practice accounts.');
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
try {
  const users = [];
  for (const [name, email, role, skills] of [
    ['Recruiter 1', 'recruiter1@test.com', 'RECRUITER', []],
    ['Recruiter 2', 'recruiter2@test.com', 'RECRUITER', []],
    ['Candidate 1', 'candidate1@test.com', 'CANDIDATE', ['React', 'TypeScript', 'Node.js', 'PostgreSQL']],
    ['Candidate 2', 'candidate2@test.com', 'CANDIDATE', ['Python', 'Docker', 'Redis', 'AWS']],
  ] as const) {
    const data = { name, email, role, skills: [...skills], passwordHash };
    users.push(await prisma.user.upsert({ where: { email }, create: data, update: data }));
  }
  const roles = [
    { id: '11111111-1111-4111-8111-111111111111', title: 'Job A — Full Stack Engineer', recruiterId: users[0]!.id, requiredSkills: ['React', 'TypeScript', 'Redis', 'Docker'], days: 18 },
    { id: '22222222-2222-4222-8222-222222222222', title: 'Job B — Python Developer', recruiterId: users[1]!.id, requiredSkills: ['Python', 'Docker', 'AWS'], days: 23 },
    { id: '33333333-3333-4333-8333-333333333333', title: 'Job C — Closed React Role', recruiterId: users[0]!.id, requiredSkills: ['React', 'TypeScript'], days: -1 },
  ];
  for (const { days, ...role } of roles) {
    const data = { ...role, description: 'Practice fixture from the project plan.', location: 'Hyderabad', deadline: new Date(Date.now() + days * 86400000) };
    await prisma.job.upsert({ where: { id: role.id }, create: data, update: data });
  }
  console.log('Created/updated four local practice accounts and Jobs A, B, C. Passwords are not printed.');
} finally { await prisma.$disconnect(); }
