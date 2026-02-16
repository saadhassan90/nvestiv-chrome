/**
 * Perplexity Deep Research Service
 *
 * Uses `sonar-deep-research` model via Perplexity's OpenAI-compatible API.
 * Autonomous multi-step research agent — runs its own searches, reads pages,
 * and produces a comprehensive research report.
 *
 * Cost: ~$0.41 per query
 */

import { logger } from '../utils/logger.js';

export interface PerplexityResearchResult {
  agent: 'perplexity';
  content: string;
  citations: string[];
  searchTimeSec: number;
  model: string;
  tokensUsed: number;
}

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

function buildResearchPrompt(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
): string {
  return `You are a senior intelligence research analyst conducting deep due diligence on an individual for alternative investment professionals.

SUBJECT:
- Name: ${name}
- Company: ${company}
- Title: ${title}
- Location: ${location}
- LinkedIn: ${linkedinUrl}

RESEARCH MISSION:
Conduct exhaustive research on this person. Search the web thoroughly for ALL available information across these categories:

1. PROFESSIONAL BACKGROUND: Full career history, previous companies, roles, dates, achievements, education, certifications, degrees.

2. INVESTMENT ACTIVITY & TRACK RECORD: Funds managed, AUM, deals participated in, exits, returns, co-investments, portfolio companies, investment thesis/strategy.

3. NETWORK & RELATIONSHIPS: Board seats, advisory roles, professional associations, co-investors, conference appearances, political donations, philanthropic activity.

4. PUBLIC PRESENCE: News articles, press releases, interviews, podcasts, publications, social media presence, thought leadership, awards.

5. RISK ASSESSMENT: Any regulatory actions (SEC, FINRA), litigation, lawsuits, controversies, bankruptcy filings, negative press, or red flags.

IDENTITY VERIFICATION:
- Many people share similar names. For EVERY piece of information, verify it belongs to THIS specific person by cross-referencing company, title, location, and career timeline.
- Clearly label any information where identity is uncertain.
- If you find conflicting information for different people with similar names, note the conflict.

OUTPUT REQUIREMENTS:
- Write detailed, multi-paragraph narrative for each category
- Include specific dates, dollar amounts, percentages, and deal names
- Cite your sources with URLs
- If information is not available, explicitly say so
- Do NOT fabricate information — only report what you find
- Be thorough — this is an investment-grade due diligence report`;
}

export async function conductPerplexityResearch(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
  apiKey: string,
): Promise<PerplexityResearchResult> {
  const startTime = Date.now();

  logger.info('Perplexity deep research starting', { name, company });

  const prompt = buildResearchPrompt(name, company, title, location, linkedinUrl);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-deep-research',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(300_000), // 5 min timeout — deep research can take a while
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string;
      };
      finish_reason: string;
    }>;
    citations?: string[];
    usage?: {
      total_tokens: number;
    };
    model: string;
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const citations = data.citations ?? [];
  const tokensUsed = data.usage?.total_tokens ?? 0;

  const searchTimeSec = Math.round((Date.now() - startTime) / 1000);

  logger.info('Perplexity deep research completed', {
    name,
    company,
    contentLength: content.length,
    citationCount: citations.length,
    tokensUsed,
    searchTimeSec,
    model: data.model,
  });

  return {
    agent: 'perplexity',
    content,
    citations,
    searchTimeSec,
    model: data.model || 'sonar-deep-research',
    tokensUsed,
  };
}
