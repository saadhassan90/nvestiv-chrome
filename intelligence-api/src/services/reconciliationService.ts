/**
 * Claude Sonnet 4.5 Reconciliation Service
 *
 * Takes research output from 3 parallel agents (Gemini, Perplexity, OpenAI)
 * and reconciles them into a single, high-quality intelligence report.
 *
 * The reconciler:
 * - Cross-references findings across all three sources
 * - Flags contradictions and assigns confidence levels
 * - Deduplicates citations while preserving the best version
 * - Produces the final structured JSON report matching our schema
 *
 * Uses Claude Sonnet 4.5 via the Anthropic API.
 * Cost: ~$0.05-0.15 per reconciliation
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import type { GeminiResearchResult } from './geminiResearchService.js';
import type { PerplexityResearchResult } from './perplexityService.js';
import type { OpenAIResearchResult } from './openaiDeepResearchService.js';

// Re-export the schema and type from geminiService (the original report structure)
const confidenceLevelEnum = z.enum(['confirmed', 'likely', 'uncertain']);

const reportSchema = z.object({
  subject: z.object({
    entity_type: z.enum(['person', 'company', 'fund']),
    full_name: z.string(),
    current_title: z.string().nullable().optional(),
    current_company: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    profile_photo_url: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    identity_markers: z.array(z.string()).default([]),
  }),
  abstract: z.object({
    summary: z.string(),
    key_findings: z.array(z.string()),
    relevance_score: z.number().min(0).max(100),
    relevance_notes: z.string(),
    identity_confidence: confidenceLevelEnum.default('likely'),
    identity_notes: z.string().default(''),
  }),
  sections: z.array(
    z.object({
      section_id: z.string(),
      section_number: z.number(),
      title: z.string(),
      subsections: z.array(
        z.object({
          subsection_id: z.string(),
          title: z.string(),
          content: z.string(),
          confidence_level: confidenceLevelEnum.default('confirmed'),
          confidence_note: z.string().default(''),
          structured_data: z.record(z.unknown()).default({}),
          citations: z.array(
            z.object({
              id: z.number(),
              citation_number: z.string(),
              text: z.string(),
              source_title: z.string(),
              source_url: z.string(),
              source_type: z.enum(['news', 'database', 'website', 'profile', 'sec_filing', 'press_release']),
              accessed_date: z.string(),
              publication_date: z.string().nullable().optional(),
              author: z.string().nullable().optional(),
              publisher: z.string().nullable().optional(),
            }),
          ),
        }),
      ),
    }),
  ),
  bibliography: z.object({
    total_sources: z.number(),
    sources_by_type: z.record(z.number()),
    all_sources: z.array(z.unknown()),
  }),
  metadata: z.object({
    generation_time_seconds: z.number(),
    ai_model: z.string(),
    total_tokens: z.number(),
    sources_analyzed: z.number(),
    quality_score: z.number(),
    completeness_score: z.number(),
    confidence_scores: z.record(z.number()),
  }),
});

export type GeneratedReport = z.infer<typeof reportSchema>;

export interface ResearchInput {
  gemini: GeminiResearchResult;
  perplexity: PerplexityResearchResult;
  openai: OpenAIResearchResult;
}

const RECONCILIATION_SYSTEM_PROMPT = `You are a senior intelligence analyst and expert fact-checker at a leading due diligence firm. You specialize in reconciling research from multiple independent sources into a single, authoritative intelligence report.

You have received research output from THREE independent AI research agents, each of which searched the web and compiled findings about the same subject. Your job is to:

1. CROSS-REFERENCE: Compare findings across all three agents. Information corroborated by 2+ agents gets "confirmed" confidence. Single-source findings get "likely" or "uncertain".

2. RESOLVE CONFLICTS: When agents disagree on facts (dates, figures, roles), investigate which version is more credible based on source quality and specificity. Note conflicts in confidence_note.

3. IDENTITY VERIFICATION: This is CRITICAL. Verify that ALL information pertains to the SAME person. Flag any findings that might be about a different person with a similar name.

4. DEDUPLICATE CITATIONS: Merge duplicate source URLs from different agents. Keep the best version of each citation (most complete metadata).

5. SYNTHESIZE: Produce a comprehensive, professional intelligence report that is BETTER than any single agent's output — richer, more accurate, and more nuanced.

CONFIDENCE TAGGING:
- "confirmed": Corroborated by 2+ agents OR from highly authoritative sources (SEC filings, official company pages)
- "likely": Found by only one agent but from a credible source, consistent with known profile
- "uncertain": Single weak source, potential identity confusion, or agents disagree

QUALITY STANDARDS:
- Write in formal analytical prose — multi-paragraph narrative, NOT bullet points
- Include specific dates, dollar amounts, percentages, deal names
- Every factual claim must have a citation with a real URL
- Do NOT fabricate URLs — only cite sources found by the research agents
- Explicitly state when information is not available
- Note when agents found conflicting information

RELEVANCE SCORING (0-100):
- 90-100: Senior partner at top-tier fund, direct LP/GP relationship potential
- 70-89: Mid-senior investment professional, relevant sector expertise
- 50-69: Tangentially relevant to alt investments
- 30-49: Peripherally connected to finance
- 0-29: No meaningful connection to alternative investments

REPORT STRUCTURE (6 required sections, each with 2-4 subsections):
1. "Executive Summary" — Overview, key highlights, investment relevance, identity verification
2. "Professional Background" — Career chronology, education, achievements
3. "Investment Activity & Track Record" — Funds, AUM, deals, exits, performance
4. "Network & Relationships" — Boards, associations, co-investors, conferences
5. "Public Presence & Reputation" — News, publications, podcasts, awards
6. "Risk Assessment" — Regulatory, litigation, controversies, or clean bill`;

const JSON_SCHEMA_PROMPT = `OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no commentary):
{
  "subject": {
    "entity_type": "person|company",
    "full_name": "...",
    "current_title": "...",
    "current_company": "...",
    "location": "...",
    "profile_photo_url": "...",
    "linkedin_url": "...",
    "email": "...",
    "phone": "...",
    "identity_markers": ["LinkedIn: ...", "Current: ... at ...", "Education: ...", "Location: ..."]
  },
  "abstract": {
    "summary": "...",
    "key_findings": ["finding1", "finding2", "finding3", "finding4"],
    "relevance_score": 0-100,
    "relevance_notes": "...",
    "identity_confidence": "confirmed|likely|uncertain",
    "identity_notes": "Reconciliation notes: which agents corroborated identity..."
  },
  "sections": [{
    "section_id": "s1",
    "section_number": 1,
    "title": "...",
    "subsections": [{
      "subsection_id": "s1.1",
      "title": "...",
      "content": "Multi-paragraph content with inline [N] citations...",
      "confidence_level": "confirmed|likely|uncertain",
      "confidence_note": "Corroborated by Agent A + Agent B | Only found by Agent C | Agents disagree...",
      "structured_data": {},
      "citations": [{
        "id": 1,
        "citation_number": "[1]",
        "text": "Claim being cited",
        "source_title": "...",
        "source_url": "https://...",
        "source_type": "news|database|website|profile|sec_filing|press_release",
        "accessed_date": "YYYY-MM-DD",
        "publication_date": "YYYY-MM-DD",
        "author": "...",
        "publisher": "..."
      }]
    }]
  }],
  "bibliography": { "total_sources": N, "sources_by_type": {...}, "all_sources": [...] },
  "metadata": { "generation_time_seconds": 0, "ai_model": "claude-sonnet-4-5-20250929", "total_tokens": 0, "sources_analyzed": N, "quality_score": 0-100, "completeness_score": 0-100, "confidence_scores": {"executive_summary": 0-100, "professional_background": 0-100, "investment_activity": 0-100, "network": 0-100, "public_presence": 0-100, "risk_assessment": 0-100} }
}`;

function buildReconciliationPrompt(
  entityData: Record<string, unknown>,
  linkedinUrl: string,
  research: ResearchInput,
): string {
  const allCitations = [
    ...research.gemini.citations,
    ...research.perplexity.citations,
    ...research.openai.citations,
  ];
  const uniqueCitations = [...new Set(allCitations)];

  return `SUBJECT PROFILE DATA:
${JSON.stringify(entityData, null, 2)}

LinkedIn URL: ${linkedinUrl}

═══════════════════════════════════════════════════════════════
RESEARCH AGENT A — Gemini/Jina (${research.gemini.sourcesFound} web sources searched, ${research.gemini.citations.length} citations)
Model: ${research.gemini.model} | Time: ${research.gemini.searchTimeSec}s
═══════════════════════════════════════════════════════════════
${research.gemini.content}

═══════════════════════════════════════════════════════════════
RESEARCH AGENT B — Perplexity Deep Research (${research.perplexity.citations.length} citations)
Model: ${research.perplexity.model} | Time: ${research.perplexity.searchTimeSec}s
═══════════════════════════════════════════════════════════════
${research.perplexity.content}

═══════════════════════════════════════════════════════════════
RESEARCH AGENT C — OpenAI Deep Research (${research.openai.citations.length} citations)
Model: ${research.openai.model} | Time: ${research.openai.searchTimeSec}s
═══════════════════════════════════════════════════════════════
${research.openai.content}

═══════════════════════════════════════════════════════════════
ALL UNIQUE SOURCE URLs (${uniqueCitations.length} total):
═══════════════════════════════════════════════════════════════
${uniqueCitations.map((url, i) => `${i + 1}. ${url}`).join('\n')}

═══════════════════════════════════════════════════════════════
RECONCILIATION TASK
═══════════════════════════════════════════════════════════════
Cross-reference ALL three research agents above. Produce a single authoritative intelligence report that:
1. Combines the best findings from each agent
2. Flags where agents agree (confirmed) vs disagree (uncertain)
3. Verifies identity consistency across all sources
4. Deduplicates and merges citations
5. Produces richer, more comprehensive content than any single agent

${JSON_SCHEMA_PROMPT}`;
}

function stripNulls(obj: unknown): unknown {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const stripped = stripNulls(value);
      if (stripped !== undefined) result[key] = stripped;
    }
    return result;
  }
  return obj;
}

export async function reconcileResearch(
  entityData: Record<string, unknown>,
  linkedinUrl: string,
  research: ResearchInput,
  anthropicApiKey: string,
  startTime: number,
): Promise<GeneratedReport> {
  logger.info('Reconciliation starting with Claude Sonnet 4.5', {
    linkedinUrl,
    agents: {
      gemini: { contentLen: research.gemini.content.length, citations: research.gemini.citations.length },
      perplexity: { contentLen: research.perplexity.content.length, citations: research.perplexity.citations.length },
      openai: { contentLen: research.openai.content.length, citations: research.openai.citations.length },
    },
  });

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const userPrompt = buildReconciliationPrompt(entityData, linkedinUrl, research);

  // Retry up to 3 times on parse failure
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logger.info(`Reconciliation attempt ${attempt}`, { linkedinUrl });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16384,
        system: RECONCILIATION_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });

      // Extract text from response
      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      const totalTokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

      logger.info('Claude reconciliation response received', {
        textLength: text.length,
        totalTokens,
        stopReason: response.stop_reason,
        attempt,
      });

      // Parse JSON
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try extracting JSON from text
        let jsonStr = text;
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1];
        } else {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            jsonStr = text.slice(firstBrace, lastBrace + 1);
          }
        }

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // Attempt repair for truncated JSON
          logger.warn('JSON parse failed, attempting repair', { lastChars: jsonStr.slice(-100) });
          let repaired = jsonStr;
          let braces = 0, brackets = 0, inString = false, escapeNext = false;
          for (const ch of repaired) {
            if (escapeNext) { escapeNext = false; continue; }
            if (ch === '\\') { escapeNext = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') braces++;
            if (ch === '}') braces--;
            if (ch === '[') brackets++;
            if (ch === ']') brackets--;
          }
          if (inString) repaired += '"';
          while (brackets > 0) { repaired += ']'; brackets--; }
          while (braces > 0) { repaired += '}'; braces--; }
          parsed = JSON.parse(repaired);
          logger.info('JSON repair successful');
        }
      }

      // Clean nulls
      parsed = stripNulls(parsed);

      // Apply defaults
      if (parsed.subject && !parsed.subject.identity_markers) {
        parsed.subject.identity_markers = [];
      }
      if (parsed.abstract) {
        if (!parsed.abstract.identity_confidence) parsed.abstract.identity_confidence = 'likely';
        if (!parsed.abstract.identity_notes) parsed.abstract.identity_notes = '';
      }
      if (parsed.sections) {
        for (const section of parsed.sections) {
          if (section.subsections) {
            for (const sub of section.subsections) {
              if (!sub.confidence_level) sub.confidence_level = 'confirmed';
              if (!sub.confidence_note) sub.confidence_note = '';
            }
          }
        }
      }

      const validated = reportSchema.parse(parsed);

      // Update metadata with council info
      const totalResearchTokens =
        research.gemini.tokensUsed +
        research.perplexity.tokensUsed +
        research.openai.tokensUsed +
        totalTokens;

      const totalCitations = new Set([
        ...research.gemini.citations,
        ...research.perplexity.citations,
        ...research.openai.citations,
      ]).size;

      validated.metadata.generation_time_seconds = Math.round((Date.now() - startTime) / 1000);
      validated.metadata.ai_model = `council:gemini+perplexity+openai→claude-sonnet-4.5`;
      validated.metadata.total_tokens = totalResearchTokens;
      validated.metadata.sources_analyzed = totalCitations;

      // Log confidence distribution
      const confidenceDist = { confirmed: 0, likely: 0, uncertain: 0 };
      for (const section of validated.sections) {
        for (const sub of section.subsections) {
          confidenceDist[sub.confidence_level]++;
        }
      }

      logger.info('Reconciled report generated successfully', {
        linkedinUrl,
        sections: validated.sections.length,
        bibliographySources: validated.bibliography.total_sources,
        totalCitations,
        totalTimeSec: validated.metadata.generation_time_seconds,
        identityConfidence: validated.abstract.identity_confidence,
        confidenceDistribution: confidenceDist,
        totalResearchTokens,
        agentTimings: {
          gemini: research.gemini.searchTimeSec,
          perplexity: research.perplexity.searchTimeSec,
          openai: research.openai.searchTimeSec,
        },
      });

      return validated;
    } catch (err) {
      logger.warn(`Reconciliation attempt ${attempt} failed`, {
        error: (err as Error).message,
        linkedinUrl,
      });
      if (attempt === 3) throw err;
      const delayMs = attempt * 10_000;
      logger.info(`Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Reconciliation failed after 3 attempts');
}
