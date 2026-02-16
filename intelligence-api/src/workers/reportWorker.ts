import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../services/supabase.js';
import { conductGeminiResearch } from '../services/geminiResearchService.js';
import { conductPerplexityResearch } from '../services/perplexityService.js';
import { conductOpenAIDeepResearch } from '../services/openaiDeepResearchService.js';
import { reconcileResearch } from '../services/reconciliationService.js';
import { generateAndStoreEmbeddings } from '../services/embeddingService.js';
import { entityManager } from '../services/entityManager.js';
import { cacheService } from '../services/cacheService.js';
import type { ReportJobData } from '../queue/reportQueue.js';

const REPORT_STEPS = [
  'Starting research',
  'Running 3 research agents in parallel',
  'Agent A (Gemini/Jina) searching',
  'Agent B (Perplexity) deep research',
  'Agent C (OpenAI) deep research',
  'Reconciling findings with Claude',
  'Storing report data',
  'Generating embeddings',
  'Updating entity records',
  'Finalizing report',
];

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

async function updateJobProgress(
  jobId: string,
  stepIndex: number,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  extra: Record<string, unknown> = {},
): Promise<void> {
  const progress = Math.round(((stepIndex + 1) / REPORT_STEPS.length) * 100);
  const completedSteps = REPORT_STEPS.slice(0, stepIndex);
  const remainingSteps = REPORT_STEPS.slice(stepIndex + 1);

  await supabase
    .from('report_jobs')
    .update({
      status,
      progress,
      current_step: REPORT_STEPS[stepIndex],
      completed_steps: completedSteps,
      remaining_steps: remainingSteps,
      ...extra,
    })
    .eq('id', jobId);
}

const worker = new Worker<ReportJobData>(
  'report-generation',
  async (job) => {
    const { entityId, linkedinUrl, extractedData, orgId } = job.data;
    const jobId = job.id!;
    const startTime = Date.now();

    logger.info('Report worker started (LLM Council)', { jobId, entityId, linkedinUrl });

    try {
      // Step 0: Starting
      await updateJobProgress(jobId, 0, 'processing', {
        started_at: new Date().toISOString(),
      });

      // Get entity canonical data for enriched context
      const entity = await entityManager.findByLinkedInUrl(linkedinUrl);
      const enrichedData = {
        ...extractedData,
        ...(entity?.canonical_data ?? {}),
      };

      // Extract identity fields
      const name = String(enrichedData.name || enrichedData.full_name || 'Unknown');
      const company = String(enrichedData.currentCompany || enrichedData.company || '');
      const title = String(enrichedData.currentTitle || enrichedData.title || '');
      const location = String(enrichedData.location || '');

      // Step 1: Launch all 3 research agents in parallel
      await updateJobProgress(jobId, 1);

      logger.info('Launching 3 research agents in parallel', {
        jobId, name, company,
        agents: ['gemini/jina', 'perplexity', 'openai'],
      });

      // Run all three agents concurrently with individual error handling
      const [geminiResult, perplexityResult, openaiResult] = await Promise.allSettled([
        conductGeminiResearch(name, company, title, location, linkedinUrl),
        conductPerplexityResearch(name, company, title, location, linkedinUrl, config.PERPLEXITY_API_KEY),
        conductOpenAIDeepResearch(name, company, title, location, linkedinUrl, config.OPENAI_API_KEY),
      ]);

      // Log agent results
      const agentResults = {
        gemini: geminiResult.status,
        perplexity: perplexityResult.status,
        openai: openaiResult.status,
      };
      logger.info('Research agents completed', { jobId, agentResults });

      // We need at least 1 agent to succeed. Provide fallback empty results for failed agents.
      const successCount = [geminiResult, perplexityResult, openaiResult]
        .filter(r => r.status === 'fulfilled').length;

      if (successCount === 0) {
        throw new Error('All 3 research agents failed. Cannot generate report.');
      }

      const gemini = geminiResult.status === 'fulfilled'
        ? geminiResult.value
        : { agent: 'gemini' as const, content: '[Agent failed — no results]', citations: [], searchTimeSec: 0, model: 'failed', tokensUsed: 0, sourcesFound: 0 };

      const perplexity = perplexityResult.status === 'fulfilled'
        ? perplexityResult.value
        : { agent: 'perplexity' as const, content: '[Agent failed — no results]', citations: [], searchTimeSec: 0, model: 'failed', tokensUsed: 0 };

      const openai = openaiResult.status === 'fulfilled'
        ? openaiResult.value
        : { agent: 'openai' as const, content: '[Agent failed — no results]', citations: [], searchTimeSec: 0, model: 'failed', tokensUsed: 0 };

      // Log any failures
      if (geminiResult.status === 'rejected') {
        logger.error('Gemini agent failed', { jobId, error: geminiResult.reason?.message });
      }
      if (perplexityResult.status === 'rejected') {
        logger.error('Perplexity agent failed', { jobId, error: perplexityResult.reason?.message });
      }
      if (openaiResult.status === 'rejected') {
        logger.error('OpenAI agent failed', { jobId, error: openaiResult.reason?.message });
      }

      // Step 5: Reconcile with Claude Sonnet 4.5
      await updateJobProgress(jobId, 5);

      logger.info('Starting reconciliation with Claude Sonnet 4.5', {
        jobId,
        agentsSucceeded: successCount,
        totalCitations:
          gemini.citations.length +
          perplexity.citations.length +
          openai.citations.length,
      });

      const report = await reconcileResearch(
        enrichedData,
        linkedinUrl,
        { gemini, perplexity, openai },
        config.ANTHROPIC_API_KEY,
        startTime,
      );

      // Step 6: Store report in Supabase
      await updateJobProgress(jobId, 6);

      const { data: storedReport, error } = await supabase
        .from('reports')
        .insert({
          entity_id: entityId,
          version: (entity?.total_reports ?? 0) + 1,
          generated_at: new Date().toISOString(),
          generated_by_org: orgId,
          report_content: report,
          subject: report.subject,
          abstract: report.abstract,
          bibliography: report.bibliography,
          metadata: report.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      // Step 7: Generate embeddings
      await updateJobProgress(jobId, 7);
      await generateAndStoreEmbeddings(entityId, storedReport.id, report);

      // Step 8: Update entity records
      await updateJobProgress(jobId, 8);
      await entityManager.updateFromReport(entityId, storedReport.id, {
        full_name: report.subject.full_name,
        current_title: report.subject.current_title,
        current_company: report.subject.current_company,
        location: report.subject.location,
        email: report.subject.email,
        phone: report.subject.phone,
        relevance_score: report.abstract.relevance_score,
      });

      // Step 9: Finalize
      const reportUrl = `${process.env.REPORTS_URL || 'http://localhost:3000'}/r/${storedReport.id}`;
      await updateJobProgress(jobId, 9, 'completed', {
        report_id: storedReport.id,
        report_url: reportUrl,
        completed_at: new Date().toISOString(),
      });

      // Invalidate caches
      await cacheService.invalidateEntity(linkedinUrl);

      const totalTimeSec = Math.round((Date.now() - startTime) / 1000);
      logger.info('LLM Council report generation completed', {
        jobId,
        reportId: storedReport.id,
        entityId,
        totalTimeSec,
        agentsSucceeded: successCount,
        agentTimings: {
          gemini: gemini.searchTimeSec,
          perplexity: perplexity.searchTimeSec,
          openai: openai.searchTimeSec,
        },
      });

      return { reportId: storedReport.id, reportUrl };
    } catch (err) {
      logger.error('Report worker failed', {
        jobId,
        entityId,
        error: (err as Error).message,
      });

      await supabase
        .from('report_jobs')
        .update({
          status: 'failed',
          error_message: (err as Error).message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      throw err;
    }
  },
  {
    connection,
    concurrency: 2, // Reduced from 3 — each job now uses more API resources
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    lockDuration: 900_000, // 15 minutes — 3 parallel agents + reconciliation
    stalledInterval: 180_000, // Check every 3 minutes
  },
);

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job?.id, error: err.message });
});

logger.info('Report worker started (LLM Council mode), waiting for jobs...');
