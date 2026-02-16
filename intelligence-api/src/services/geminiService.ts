import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { conductResearch, formatDossierForLLM } from './webResearchService.js';

// Model selection — override via REPORT_MODEL env var.
const REPORT_MODEL = process.env.REPORT_MODEL || 'gpt-4o';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// ─── Confidence levels for content blocks ────────────────────────────
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

const SYSTEM_PROMPT = `You are a senior intelligence research analyst at a leading due diligence firm serving alternative investment professionals — hedge funds, private equity firms, venture capital, family offices, and institutional allocators.

You have been provided with a RESEARCH DOSSIER containing web search results gathered from multiple queries about the subject. Your job is to analyze ALL of this source material and synthesize it into a comprehensive, investment-grade intelligence report.

═══════════════════════════════════════════════════════════════
IDENTITY VERIFICATION — MOST CRITICAL RULE
═══════════════════════════════════════════════════════════════

You MUST verify that EVERY piece of information you include actually belongs to the SPECIFIC person or entity described. Many people share similar names. Mixing up identities is the WORST error you can make.

For EVERY piece of information from the research dossier:
- Does the source mention the same company/role as the subject?
- Does the location match?
- Does the career timeline make sense?
- Could this be a DIFFERENT person with the same name?

If information MIGHT belong to a different person:
- DO NOT include it as confirmed
- Either exclude it entirely or mark as "uncertain" with an explicit note

CONFIDENCE TAGGING RULES:
Every subsection MUST have a confidence_level:
- "confirmed": Corroborated by 2+ independent sources clearly referencing the same person. Default for LinkedIn profile data.
- "likely": Single credible source, consistent with known profile, not independently verified.
- "uncertain": Identity ambiguous — could be a different person. Or single weak/unverified source.

Each subsection must have a confidence_note explaining WHY that level was assigned.

═══════════════════════════════════════════════════════════════

REPORT QUALITY REQUIREMENTS:
- Write in a formal, analytical tone — this is a professional intelligence document
- Use detailed, multi-paragraph narrative (NOT bullet points)
- Include specific dates, dollar amounts, percentages, and deal names from the sources
- Provide direct quotes with proper attribution
- Analyze patterns and draw insights — don't just list facts
- Every factual claim MUST be backed by a citation with a real URL from the research dossier
- DO NOT fabricate URLs — only cite sources that appear in the provided dossier
- If information is not available in the sources, explicitly state so
- You have REAL web data to work with — use it thoroughly

RELEVANCE SCORING (0-100):
- 90-100: Senior partner at top-tier fund, direct LP/GP relationship potential
- 70-89: Mid-senior investment professional, relevant sector expertise
- 50-69: Tangentially relevant to alt investments, emerging career
- 30-49: Peripherally connected to finance
- 0-29: No meaningful connection to alternative investments

REPORT SECTIONS (6 required, each with 2-4 subsections):

1. "Executive Summary" — Overview, key highlights, investment relevance, identity verification note.
2. "Professional Background" — Career chronology, roles, achievements, education, certifications.
3. "Investment Activity & Track Record" — Funds, AUM, deals, exits, performance, co-investments.
4. "Network & Relationships" — Boards, associations, co-investors, conferences, political activity.
5. "Public Presence & Reputation" — News, publications, podcasts, social media, awards.
6. "Risk Assessment" — Regulatory, litigation, bankruptcy, controversies, red flags or clean bill.`;

const JSON_SCHEMA = `OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no extra text):
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
    "identity_markers": ["LinkedIn: ...", "Current: ... at ... since ...", "Education: ...", "Location: ..."]
  },
  "abstract": {
    "summary": "...",
    "key_findings": ["finding1", "finding2", "finding3", "finding4"],
    "relevance_score": 0-100,
    "relevance_notes": "...",
    "identity_confidence": "confirmed|likely|uncertain",
    "identity_notes": "..."
  },
  "sections": [{
    "section_id": "s1",
    "section_number": 1,
    "title": "...",
    "subsections": [{
      "subsection_id": "s1.1",
      "title": "...",
      "content": "Multi-paragraph content with inline [1] citations referencing the sources provided...",
      "confidence_level": "confirmed|likely|uncertain",
      "confidence_note": "...",
      "structured_data": {},
      "citations": [{
        "id": 1,
        "citation_number": "[1]",
        "text": "Claim being cited",
        "source_title": "Title from the research dossier",
        "source_url": "https://actual-url-from-dossier.com/path",
        "source_type": "news|database|website|profile|sec_filing|press_release",
        "accessed_date": "YYYY-MM-DD",
        "publication_date": "YYYY-MM-DD",
        "author": "...",
        "publisher": "..."
      }]
    }]
  }],
  "bibliography": { "total_sources": N, "sources_by_type": {...}, "all_sources": [...] },
  "metadata": { "generation_time_seconds": 0, "ai_model": "MODEL", "total_tokens": 0, "sources_analyzed": N, "quality_score": 0-100, "completeness_score": 0-100, "confidence_scores": {"executive_summary": 0-100, "professional_background": 0-100, "investment_activity": 0-100, "network": 0-100, "public_presence": 0-100, "risk_assessment": 0-100} }
}`;

export async function generateReport(
  entityData: Record<string, unknown>,
  linkedinUrl: string,
): Promise<GeneratedReport> {
  const startTime = Date.now();

  // Extract identity fields
  const name = String(entityData.name || entityData.full_name || 'Unknown');
  const company = String(entityData.currentCompany || entityData.company || '');
  const title = String(entityData.currentTitle || entityData.title || '');
  const location = String(entityData.location || '');

  // ═══ STEP 1: Conduct multi-step web research ═══
  logger.info('Step 1: Conducting web research', { name, company });
  const dossier = await conductResearch(
    name, company, title, location, linkedinUrl,
    config.OPENAI_API_KEY,
  );

  // Format the dossier for the LLM
  // Limit dossier to 100K chars — leaves room for the LLM to generate a full 6-section report
  const dossierText = formatDossierForLLM(dossier, 100_000);
  const entityContext = JSON.stringify(entityData, null, 2);

  logger.info('Research dossier compiled', {
    sources: dossier.sources.length,
    totalContentLength: dossier.totalContentLength,
    searchTimeSec: dossier.searchTime,
  });

  // ═══ STEP 2: Synthesize report with LLM ═══
  const userPrompt = `SUBJECT PROFILE DATA:
${entityContext}

LinkedIn URL: ${linkedinUrl}

${dossierText}

Based on ALL the source materials above, produce a comprehensive intelligence report. Use the actual content from each source — cite URLs from the dossier, quote relevant passages, extract specific facts, dates, and figures. Every section should be substantive and data-rich.

${JSON_SCHEMA}`;

  // Retry up to 3 times on parse failure
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logger.info(`Step 2: Synthesizing report (attempt ${attempt})`, {
        model: REPORT_MODEL,
        dossierSources: dossier.sources.length,
      });

      const response = await openai.chat.completions.create({
        model: REPORT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content ?? '';
      const totalTokens = response.usage?.total_tokens ?? 0;
      const finishReason = response.choices[0]?.finish_reason;

      logger.info('LLM synthesis response', {
        textLength: text.length,
        totalTokens,
        finishReason,
        attempt,
      });

      // Parse JSON (with response_format: json_object, it should be clean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        // Try to extract JSON from text
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
          logger.warn('JSON parse failed, attempting repair', {
            error: (jsonErr as Error).message,
            lastChars: jsonStr.slice(-100),
          });

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

      // Convert null values to undefined (LLMs often return null for missing fields)
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
      parsed = stripNulls(parsed);

      // Apply defaults for optional new fields
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

      // Update metadata
      validated.metadata.generation_time_seconds = Math.round((Date.now() - startTime) / 1000);
      validated.metadata.ai_model = REPORT_MODEL;
      validated.metadata.total_tokens = totalTokens;
      validated.metadata.sources_analyzed = dossier.sources.length;

      // Log confidence distribution
      const confidenceDist = { confirmed: 0, likely: 0, uncertain: 0 };
      for (const section of validated.sections) {
        for (const sub of section.subsections) {
          confidenceDist[sub.confidence_level]++;
        }
      }

      logger.info('Report generated successfully', {
        linkedinUrl,
        model: REPORT_MODEL,
        sections: validated.sections.length,
        bibliographySources: validated.bibliography.total_sources,
        researchSources: dossier.sources.length,
        totalTimeSec: validated.metadata.generation_time_seconds,
        searchTimeSec: dossier.searchTime,
        identityConfidence: validated.abstract.identity_confidence,
        confidenceDistribution: confidenceDist,
        totalTokens,
        attempt,
      });

      return validated;
    } catch (err) {
      logger.warn(`Report generation attempt ${attempt} failed`, {
        error: (err as Error).message,
        linkedinUrl,
        model: REPORT_MODEL,
      });
      if (attempt === 3) throw err;
      const delayMs = attempt * 15_000;
      logger.info(`Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Report generation failed after 3 attempts');
}
