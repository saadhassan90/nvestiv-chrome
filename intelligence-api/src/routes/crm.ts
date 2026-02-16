import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { mapReportToCRM } from '../services/crmMapper.js';
import { logger } from '../utils/logger.js';

const enrichBodySchema = z.object({
  report_id: z.string().uuid().optional(),
  linkedin_url: z.string().url().optional(),
  mode: z.enum(['quick_add', 'enrich']),
  profile_data: z.record(z.unknown()).optional(),
});

export async function crmRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/intelligence/crm/enrich
  app.post(
    '/api/intelligence/crm/enrich',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = enrichBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.issues });
      }

      const { report_id, mode, profile_data } = parseResult.data;

      try {
        if (mode === 'enrich' && report_id) {
          // Enrich from existing report
          const { data: report, error } = await supabase
            .from('reports')
            .select('report_content, subject, abstract')
            .eq('id', report_id)
            .single();

          if (error || !report) {
            return reply.code(404).send({ error: 'Report not found' });
          }

          const crmData = mapReportToCRM(
            report.subject,
            report.abstract,
            report.report_content,
          );

          // In production, this would call the main Nvestiv CRM API
          // For now, return the mapped data
          logger.info('CRM enrichment completed', {
            reportId: report_id,
            entityType: crmData.entity_type,
          });

          return {
            success: true,
            crm_entity_type: crmData.entity_type,
            fields: crmData.fields,
            message: 'CRM enrichment data prepared',
          };
        }

        if (mode === 'quick_add' && profile_data) {
          // Quick add from scraped LinkedIn data
          const profileName = (profile_data.fullName as string) || 'Unknown';
          const crmData = mapReportToCRM(
            {
              entity_type: 'person',
              full_name: profileName,
              current_title: profile_data.currentTitle as string | undefined,
              current_company: profile_data.currentCompany as string | undefined,
              location: profile_data.location as string | undefined,
            },
            {
              relevance_score: 50,
              summary: `Quick add from LinkedIn profile: ${profileName}`,
            },
            {},
          );

          logger.info('CRM quick add completed', { name: profileName });

          return {
            success: true,
            crm_entity_type: crmData.entity_type,
            fields: crmData.fields,
            message: 'Quick add data prepared',
          };
        }

        return reply.code(400).send({ error: 'Invalid mode/data combination' });
      } catch (err) {
        logger.error('CRM enrichment failed', { error: (err as Error).message });
        return reply.code(500).send({ error: 'CRM enrichment failed' });
      }
    },
  );
}
