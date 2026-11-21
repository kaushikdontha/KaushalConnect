import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });
const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const marker = '[KaushalConnect demo listing]';
const roles: [string, string, string[]][] = [
  ['Frontend Developer', 'BrightPath Digital', ['React', 'TypeScript', 'CSS']], ['Customer Support Associate', 'CareLoop', ['Communication', 'Problem solving', 'CRM']], ['Data Analyst', 'Northstar Insights', ['SQL', 'Excel', 'Power BI']], ['Graphic Designer', 'Paperplane Studio', ['Figma', 'Illustrator', 'Branding']], ['Digital Marketing Executive', 'MarketMint', ['SEO', 'Social media', 'Analytics']], ['Sales Development Representative', 'Fieldstone', ['Communication', 'CRM', 'Negotiation']], ['Junior Accountant', 'LedgerLeaf', ['Excel', 'Bookkeeping', 'Tally']], ['QA Tester', 'PixelForge', ['Manual testing', 'Jira', 'Attention to detail']], ['Operations Coordinator', 'Daybridge', ['Coordination', 'Excel', 'Communication']], ['UI/UX Designer', 'Goodform Labs', ['Figma', 'Prototyping', 'User research']],
  ['Backend Developer', 'Copperline Tech', ['Node.js', 'PostgreSQL', 'APIs']], ['HR Assistant', 'PeopleSpring', ['Recruiting', 'Communication', 'Organization']], ['Content Writer', 'Goodword Media', ['Writing', 'Research', 'SEO']], ['IT Helpdesk Technician', 'CloudHarbor', ['Troubleshooting', 'Windows', 'Networking']], ['Project Coordinator', 'CommonThread', ['Project planning', 'Communication', 'Excel']], ['Retail Team Lead', 'Juniper Market', ['Customer service', 'Leadership', 'Point of sale']], ['Warehouse Associate', 'Parcel & Pine', ['Inventory', 'Safety', 'Teamwork']], ['Product Support Specialist', 'OrbitDesk', ['SaaS', 'Troubleshooting', 'Writing']], ['Bookkeeping Assistant', 'LedgerLeaf', ['Bookkeeping', 'Excel', 'Tally']], ['Social Media Coordinator', 'MarketMint', ['Social media', 'Canva', 'Copywriting']],
];
const cities = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Remote'];

async function main() {
  await prisma.$connect();
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(randomBytes(32).toString('hex'), salt, 64)) as Buffer;
  const recruiter = await prisma.user.upsert({ where: { email: 'demo-recruiter@kaushalconnect.local' }, update: {}, create: { name: 'KaushalConnect Demo Recruiter', email: 'demo-recruiter@kaushalconnect.local', role: 'RECRUITER', skills: [], passwordHash: `scrypt$${salt}$${hash.toString('hex')}` } });
  const jobs = Array.from({ length: 100 }, (_, i) => {
    const [title, company, requiredSkills] = roles[i % roles.length];
    const location = cities[Math.floor(i / roles.length) % cities.length];
    return { recruiterId: recruiter.id, title, location, requiredSkills, deadline: new Date(Date.now() + (20 + i % 70) * 86400000), description: `${marker} ${company} is looking for a ${title.toLowerCase()} to join its ${location === 'Remote' ? 'distributed' : location}-based team. You will contribute to day-to-day projects, collaborate with colleagues, and help deliver a thoughtful experience for customers. Applicants should bring curiosity, reliability, and a willingness to learn.` };
  });
  await prisma.$transaction(jobs.map((job, i) => prisma.job.upsert({
    where: { id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` },
    update: {},
    create: { ...job, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` },
  })));
  const count = await prisma.job.count({ where: { recruiterId: recruiter.id, description: { contains: marker } } });
  console.log(`Database contains ${count} demo jobs. Recruiter: ${recruiter.email}`);
}

main().catch((error) => {
  if (error instanceof Error && error.message.includes("Can't reach database server")) {
    console.error('Database unavailable. Start PostgreSQL at the DATABASE_URL configured in .env, then run npm.cmd run db:deploy and npm.cmd run db:seed:demo.');
  } else {
    console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
