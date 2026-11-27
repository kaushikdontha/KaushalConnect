import { prisma } from '../config/database.js';
import { eventKey, type DecisionEvent } from './queue.js';
export async function recordDecision(event: DecisionEvent) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: event.applicationId }, include: { job: { select: { title: true } } } });
  if (application.status !== event.status) throw new Error('Notification status does not match application');
  return prisma.notification.upsert({ where: { eventKey: eventKey(event) }, update: {}, create: {
    eventKey: eventKey(event), applicationId: application.id, userId: application.candidateId,
    message: `Your application for ${application.job.title} was ${event.status.toLowerCase()}.`,
  } });
}
