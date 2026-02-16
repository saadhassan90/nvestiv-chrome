import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reportQueue } from '../queue/reportQueue.js';
import { entityManager } from '../services/entityManager.js';
import { cacheService } from '../services/cacheService.js';
import { supabase } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const scrapeBodySchema = z.object({
  linkedin_url: z.string().url(),
  entity_type: z.enum(['person', 'company']),
  extracted_data: z.record(z.unknown()),
});

const generateBodySchema = z.object({
  entity: z.object({
    linkedin_url: z.string().url(),
    entity_type: z.enum(['person', 'company']),
    extracted_data: z.record(z.unknown()).optional(),
  }),
  options: z
    .object({
      priority: z.enum(['normal', 'high']).optional(),
      notify_when_complete: z.boolean().optional(),
    })
    .optional(),
});

export async function intelligenceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/intelligence/exists?entity={url}
  app.get(
    '/api/intelligence/exists',
    async (request: FastifyRequest<{ Querystring: { entity: string } }>, reply: FastifyReply) => {
      const { entity } = request.query;
      if (!entity) {
        return reply.code(400).send({ error: 'Missing entity parameter' });
      }

      // Check cache first
      const cached = await cacheService.getEntityStatus(entity);
      if (cached) {
        return JSON.parse(cached);
      }

      const status = await entityManager.getEntityStatus(entity);

      // Cache the result
      await cacheService.setEntityStatus(entity, status);

      return status;
    },
  );

  // POST /api/intelligence/entity/scrape - Passive data collection
  app.post(
    '/api/intelligence/entity/scrape',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = scrapeBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.issues });
      }

      const { linkedin_url, entity_type, extracted_data } = parseResult.data;

      try {
        const entity = await entityManager.upsertFromScrape(
          linkedin_url,
          entity_type,
          extracted_data as unknown as Parameters<typeof entityManager.upsertFromScrape>[2],
          request.auth.org_id,
        );

        // Invalidate cache
        await cacheService.invalidateEntity(linkedin_url);

        return { success: true, entity_id: entity.id };
      } catch (err) {
        logger.error('Scrape storage failed', { error: (err as Error).message });
        return reply.code(500).send({ error: 'Failed to store scraped data' });
      }
    },
  );

  // POST /api/intelligence/generate - Queue report generation
  app.post(
    '/api/intelligence/generate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = generateBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.issues });
      }

      const { entity, options } = parseResult.data;

      try {
        // Find or create entity
        let entityRecord = await entityManager.findByLinkedInUrl(entity.linkedin_url);
        if (!entityRecord) {
          entityRecord = await entityManager.upsertFromScrape(
            entity.linkedin_url,
            entity.entity_type,
            (entity.extracted_data ?? {}) as unknown as Parameters<typeof entityManager.upsertFromScrape>[2],
            request.auth.org_id,
          );
        }

        // Create job record in Supabase
        const { data: job, error } = await supabase
          .from('report_jobs')
          .insert({
            entity_id: entityRecord.id,
            status: 'queued',
            progress: 0,
            org_id: request.auth.org_id,
            created_by: request.auth.user_id,
          })
          .select()
          .single();

        if (error) throw error;

        // Queue the job
        await reportQueue.add(
          'generate-report',
          {
            entityId: entityRecord.id,
            linkedinUrl: entity.linkedin_url,
            entityType: entity.entity_type,
            extractedData: entity.extracted_data ?? {},
            orgId: request.auth.org_id,
            userId: request.auth.user_id,
          },
          {
            jobId: job.id,
            priority: options?.priority === 'high' ? 1 : 5,
          },
        );

        logger.info('Report generation queued', { jobId: job.id, entityId: entityRecord.id });

        return {
          job_id: job.id,
          entity_id: entityRecord.id,
          status: 'queued',
          estimated_time_seconds: 120,
        };
      } catch (err) {
        logger.error('Report generation failed to queue', { error: (err as Error).message });
        return reply.code(500).send({ error: 'Failed to queue report generation' });
      }
    },
  );

  // GET /api/intelligence/status/:jobId - Get job progress
  app.get(
    '/api/intelligence/status/:jobId',
    async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      const { jobId } = request.params;

      const { data: job, error } = await supabase
        .from('report_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      return {
        job_id: job.id,
        status: job.status,
        progress: job.progress,
        current_step: job.current_step,
        completed_steps: job.completed_steps,
        remaining_steps: job.remaining_steps,
        started_at: job.started_at,
        report_id: job.report_id,
        report_url: job.report_url,
        completed_at: job.completed_at,
        error_message: job.error_message,
      };
    },
  );

  // GET /api/intelligence/report/:reportId - Get full report
  app.get(
    '/api/intelligence/report/:reportId',
    async (request: FastifyRequest<{ Params: { reportId: string } }>, reply: FastifyReply) => {
      const { reportId } = request.params;

      // Check cache
      const cached = await cacheService.getReport(reportId);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data: report, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error || !report) {
        return reply.code(404).send({ error: 'Report not found' });
      }

      // Check org access
      if (report.org_id !== request.auth.org_id) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Cache the report
      await cacheService.setReport(reportId, report);

      return report;
    },
  );

  // POST /api/intelligence/refresh/:reportId - Regenerate report
  app.post(
    '/api/intelligence/refresh/:reportId',
    async (request: FastifyRequest<{ Params: { reportId: string } }>, reply: FastifyReply) => {
      const { reportId } = request.params;

      const { data: report, error } = await supabase
        .from('reports')
        .select('entity_id, org_id')
        .eq('id', reportId)
        .single();

      if (error || !report) {
        return reply.code(404).send({ error: 'Report not found' });
      }

      if (report.org_id !== request.auth.org_id) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Get entity info
      const { data: entity } = await supabase
        .from('entities')
        .select('*')
        .eq('id', report.entity_id)
        .single();

      if (!entity) {
        return reply.code(404).send({ error: 'Entity not found' });
      }

      // Create new job
      const { data: job, error: jobError } = await supabase
        .from('report_jobs')
        .insert({
          entity_id: entity.id,
          status: 'queued',
          progress: 0,
          org_id: request.auth.org_id,
          created_by: request.auth.user_id,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      await reportQueue.add(
        'generate-report',
        {
          entityId: entity.id,
          linkedinUrl: entity.linkedin_url,
          entityType: entity.entity_type,
          extractedData: entity.canonical_data ?? {},
          orgId: request.auth.org_id,
          userId: request.auth.user_id,
        },
        { jobId: job.id },
      );

      // Invalidate caches
      await cacheService.invalidateReport(reportId);
      await cacheService.invalidateEntity(entity.linkedin_url);

      return {
        job_id: job.id,
        entity_id: entity.id,
        status: 'queued',
        estimated_time_seconds: 120,
      };
    },
  );
}
