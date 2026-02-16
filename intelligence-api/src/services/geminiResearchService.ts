/**
 * Gemini Research Service
 *
 * Uses the existing Jina Search + OpenAI pipeline to conduct web research
 * and produce an intermediate research result (raw text + citations),
 * NOT the final report. The final report is synthesized by the reconciliation service.
 *
 * This is the cheapest agent (~$0.05-0.10 per query) — uses Jina for search
 * and GPT-4o for synthesis into a research narrative.
 *
 * Reuses the existing webResearchService for the actual search mechanics.
 */

import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { conductResearch, formatDossierForLLM } from './webResearchService.js';

export interface GeminiResearchResult {
  agent: 'gemini';
  content: string;
  citations: string[];
  searchTimeSec: number;
  model: string;
  tokensUsed: number;
  sourcesFound: number;
}

const RESEARCH_MODEL = process.env.REPORT_MODEL || 'gpt-4o';

const RESEARCH_SYNTHESIS_PROMPT = `You are a senior intelligence research analyst. You have been provided with a research dossier containing web search results about a person. Your job is to synthesize ALL of this source material into a comprehensive, structured research narrative.

IDENTITY VERIFICATION — CRITICAL:
Many people share similar names. For EVERY piece of information:
- Does the source mention the same company/role as the subject?
- Does the location match?
- Could this be a DIFFERENT person?
If identity is ambiguous, clearly flag it.

OUTPUT REQUIREMENTS:
Organize your findings into these categories, with detailed multi-paragraph narrative for each:

1. PROFESSIONAL BACKGROUND: Career history, roles, companies, education, certifications
2. INVESTMENT ACTIVITY & TRACK RECORD: Funds, AUM, deals, exits, performance
3. NETWORK & RELATIONSHIPS: Boards, associations, co-investors, conferences
4. PUBLIC PRESENCE: News, publications, interviews, social media
5. RISK ASSESSMENT: Regulatory, litigation, controversies, red flags

For each finding:
- Write detailed narrative paragraphs
- Include specific dates, dollar amounts, percentages
- Note the source URL for each claim
- Mark uncertain or potentially misattributed information as [UNCERTAIN]
- If a category has no findings, say "No information found"

Do NOT fabricate information. Only report what appears in the source materials.`;

export async function conductGeminiResearch(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
): Promise<GeminiResearchResult> {
  const startTime = Date.now();

  logger.info('Gemini research agent starting', { name, company });

  // Step 1: Conduct web research via Jina + fallback
  const dossier = await conductResearch(
    name, company, title, location, linkedinUrl,
    config.OPENAI_API_KEY,
  );

  const dossierText = formatDossierForLLM(dossier, 100_000);

  logger.info('Gemini agent: dossier compiled', {
    sources: dossier.sources.length,
    totalContentLength: dossier.totalContentLength,
  });

  // Step 2: Synthesize into research narrative using OpenAI
  const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: RESEARCH_MODEL,
    messages: [
      { role: 'system', content: RESEARCH_SYNTHESIS_PROMPT },
      {
        role: 'user',
        content: `SUBJECT: ${name}, ${title} at ${company}, ${location}
LinkedIn: ${linkedinUrl}

${dossierText}

Synthesize ALL the source materials above into a comprehensive research narrative. Cite source URLs for every claim.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 12000,
  });

  const content = response.choices[0]?.message?.content ?? '';
  const tokensUsed = response.usage?.total_tokens ?? 0;

  // Extract citation URLs from the dossier sources
  const citations = dossier.sources.map(s => s.url);

  const searchTimeSec = Math.round((Date.now() - startTime) / 1000);

  logger.info('Gemini research agent completed', {
    name,
    company,
    contentLength: content.length,
    citationCount: citations.length,
    sourcesFound: dossier.sources.length,
    tokensUsed,
    searchTimeSec,
  });

  return {
    agent: 'gemini',
    content,
    citations,
    searchTimeSec,
    model: RESEARCH_MODEL,
    tokensUsed,
    sourcesFound: dossier.sources.length,
  };
}
