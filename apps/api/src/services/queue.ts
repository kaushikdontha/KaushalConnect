import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
export type DecisionEvent = { applicationId: string; status: 'SHORTLISTED' | 'REJECTED' };
export const eventKey = (event: DecisionEvent) => `${event.applicationId}-${event.status}`;
export async function enqueueDecision(event: DecisionEvent) {
  const connection = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1500, commandTimeout: 2000, retryStrategy: () => null });
  connection.on('error', () => {});
  let queue: Queue | undefined;
  try {
    await connection.connect();
    queue = new Queue(env.NOTIFICATION_QUEUE, { connection });
    await queue.add('application-decision', event, { jobId: eventKey(event), attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 1000 });
  } finally {
    try { if (queue) await queue.close(); }
    finally { connection.disconnect(); }
  }
}
