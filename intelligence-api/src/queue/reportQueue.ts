import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error', { error: err.message }));

export const reportQueue = new Queue('report-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export interface ReportJobData {
  entityId: string;
  linkedinUrl: string;
  entityType: 'person' | 'company';
  extractedData: Record<string, unknown>;
  orgId: string;
  userId: string;
}
