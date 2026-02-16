import { redisConnection } from '../queue/reportQueue.js';
import { logger } from '../utils/logger.js';

const ENTITY_STATUS_TTL = 300; // 5 minutes
const REPORT_TTL = 3600; // 1 hour

export const cacheService = {
  async getEntityStatus(linkedinUrl: string): Promise<string | null> {
    try {
      const key = `entity_status:${encodeURIComponent(linkedinUrl)}`;
      return await redisConnection.get(key);
    } catch (err) {
      logger.warn('Cache get failed', { error: (err as Error).message });
      return null;
    }
  },

  async setEntityStatus(linkedinUrl: string, data: unknown): Promise<void> {
    try {
      const key = `entity_status:${encodeURIComponent(linkedinUrl)}`;
      await redisConnection.set(key, JSON.stringify(data), 'EX', ENTITY_STATUS_TTL);
    } catch (err) {
      logger.warn('Cache set failed', { error: (err as Error).message });
    }
  },

  async getReport(reportId: string): Promise<string | null> {
    try {
      const key = `report:${reportId}`;
      return await redisConnection.get(key);
    } catch (err) {
      logger.warn('Cache get failed', { error: (err as Error).message });
      return null;
    }
  },

  async setReport(reportId: string, data: unknown): Promise<void> {
    try {
      const key = `report:${reportId}`;
      await redisConnection.set(key, JSON.stringify(data), 'EX', REPORT_TTL);
    } catch (err) {
      logger.warn('Cache set failed', { error: (err as Error).message });
    }
  },

  async invalidateEntity(linkedinUrl: string): Promise<void> {
    try {
      const key = `entity_status:${encodeURIComponent(linkedinUrl)}`;
      await redisConnection.del(key);
    } catch (err) {
      logger.warn('Cache invalidation failed', { error: (err as Error).message });
    }
  },

  async invalidateReport(reportId: string): Promise<void> {
    try {
      const key = `report:${reportId}`;
      await redisConnection.del(key);
    } catch (err) {
      logger.warn('Cache invalidation failed', { error: (err as Error).message });
    }
  },
};
