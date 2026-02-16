import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { generateEmbedding } from '../services/embeddingService.js';
import { logger } from '../utils/logger.js';

const searchBodySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(50).optional().default(10),
  entity_type: z.enum(['person', 'company']).optional(),
});

const ragQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  entity_id: z.string().uuid().optional(),
  limit: z.number().min(1).max(20).optional().default(5),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/intelligence/search/entities - Semantic entity search
  app.post(
    '/api/intelligence/search/entities',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = searchBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.issues });
      }

      const { query, limit, entity_type } = parseResult.data;

      try {
        const queryEmbedding = await generateEmbedding(query);

        // Use the RPC function with its actual parameter names
        const { data, error } = await supabase.rpc('search_similar_entities', {
          query_embedding: queryEmbedding,
          match_count: limit,
        });

        if (error) {
          logger.error('Entity search failed', { error: error.message });
          return reply.code(500).send({ error: 'Search failed' });
        }

        // Filter by entity_type client-side if specified
        let results = data ?? [];
        if (entity_type) {
          results = results.filter((r: Record<string, unknown>) => r.entity_type === entity_type);
        }

        return {
          results,
          query,
          count: results.length,
        };
      } catch (err) {
        logger.error('Entity search error', { error: (err as Error).message });
        return reply.code(500).send({ error: 'Search failed' });
      }
    },
  );

  // POST /api/intelligence/rag/query - RAG query over report sections
  app.post(
    '/api/intelligence/rag/query',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = ragQuerySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.issues });
      }

      const { query, entity_id, limit } = parseResult.data;

      try {
        const queryEmbedding = await generateEmbedding(query);

        // Use the RPC function with its actual parameter names
        const { data, error } = await supabase.rpc('retrieve_report_sections', {
          query_embedding: queryEmbedding,
          match_count: limit,
        });

        if (error) {
          logger.error('RAG query failed', { error: error.message });
          return reply.code(500).send({ error: 'RAG query failed' });
        }

        // Filter by entity_id client-side if specified
        let results = (data ?? []).map((row: Record<string, unknown>) => ({
          section_id: row.section_id,
          report_id: row.report_id,
          content: row.text_content,
          similarity: row.similarity,
        }));

        if (entity_id) {
          // Join with reports to filter by entity
          const { data: reportIds } = await supabase
            .from('reports')
            .select('id')
            .eq('entity_id', entity_id);

          const validReportIds = new Set((reportIds ?? []).map((r: Record<string, unknown>) => r.id));
          results = results.filter((r: { report_id: unknown }) => validReportIds.has(r.report_id));
        }

        return {
          results,
          query,
          count: results.length,
        };
      } catch (err) {
        logger.error('RAG query error', { error: (err as Error).message });
        return reply.code(500).send({ error: 'RAG query failed' });
      }
    },
  );
}
