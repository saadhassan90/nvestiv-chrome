import OpenAI from 'openai';
import { config } from '../config.js';
import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';
import type { GeneratedReport } from './geminiService.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 10;

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

/**
 * Generate a single embedding vector for a text string.
 * Used by search/RAG endpoints.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await getEmbeddings([text]);
  return embedding;
}

export async function generateAndStoreEmbeddings(
  entityId: string,
  reportId: string,
  report: GeneratedReport,
): Promise<void> {
  try {
    // 1. Entity-level embedding (profile summary)
    const entityText = [
      report.subject.full_name,
      report.subject.current_title,
      report.subject.current_company,
      report.abstract.summary,
      report.abstract.key_findings.join('. '),
    ]
      .filter(Boolean)
      .join('. ');

    const [entityEmbedding] = await getEmbeddings([entityText]);

    // Upsert entity embedding
    await supabase.from('entity_embeddings').upsert(
      {
        entity_id: entityId,
        embedding: entityEmbedding,
        text_content: entityText.slice(0, 2000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entity_id' },
    );

    // 2. Section-level embeddings
    const sectionTexts: string[] = [];
    const sectionMeta: Array<{ sectionId: string; subsectionId: string }> = [];

    for (const section of report.sections) {
      for (const sub of section.subsections) {
        sectionTexts.push(`${section.title}: ${sub.title}. ${sub.content}`);
        sectionMeta.push({
          sectionId: section.section_id,
          subsectionId: sub.subsection_id,
        });
      }
    }

    if (sectionTexts.length > 0) {
      const sectionEmbeddings = await getEmbeddings(sectionTexts);

      const rows = sectionEmbeddings.map((embedding, idx) => ({
        report_id: reportId,
        section_id: sectionMeta[idx].sectionId,
        subsection_id: sectionMeta[idx].subsectionId,
        embedding,
        text_content: sectionTexts[idx].slice(0, 2000),
      }));

      await supabase.from('report_section_embeddings').insert(rows);
    }

    // 3. Citation-level embeddings
    const citationTexts: string[] = [];
    const citationIds: number[] = [];

    for (const section of report.sections) {
      for (const sub of section.subsections) {
        for (const citation of sub.citations) {
          citationTexts.push(`${citation.text} - ${citation.source_title}`);
          citationIds.push(citation.id);
        }
      }
    }

    if (citationTexts.length > 0) {
      const citationEmbeddings = await getEmbeddings(citationTexts);

      const rows = citationEmbeddings.map((embedding, idx) => ({
        report_id: reportId,
        citation_id: citationIds[idx],
        embedding,
        text_content: citationTexts[idx].slice(0, 2000),
      }));

      await supabase.from('citation_embeddings').insert(rows);
    }

    logger.info('Embeddings generated and stored', {
      entityId,
      reportId,
      entityEmbeddings: 1,
      sectionEmbeddings: sectionTexts.length,
      citationEmbeddings: citationTexts.length,
    });
  } catch (err) {
    logger.error('Embedding generation failed', { error: (err as Error).message, entityId, reportId });
    throw err;
  }
}
