/**
 * OpenAI Deep Research Service
 *
 * Uses `o4-mini-deep-research` model via the OpenAI Responses API.
 * Autonomous multi-step research agent with web_search_preview and
 * code_interpreter tools — searches the web, reads pages, synthesizes findings.
 *
 * Cost: ~$0.92 per query
 *
 * Note: Deep research responses can take 1-5 minutes. The model autonomously
 * decides how many searches to run and how deep to go.
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export interface OpenAIResearchResult {
  agent: 'openai';
  content: string;
  citations: string[];
  searchTimeSec: number;
  model: string;
  tokensUsed: number;
}

function buildResearchPrompt(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
): string {
  return `Conduct deep research on the following person for an investment due diligence report.

SUBJECT:
- Name: ${name}
- Company: ${company}
- Title: ${title}
- Location: ${location}
- LinkedIn: ${linkedinUrl}

RESEARCH REQUIREMENTS:
Search the web extensively to find ALL available information on this person across these categories:

1. PROFESSIONAL BACKGROUND
   - Complete career history with companies, titles, dates
   - Education (schools, degrees, years)
   - Professional certifications and licenses

2. INVESTMENT ACTIVITY & TRACK RECORD
   - Funds managed or associated with, AUM figures
   - Notable deals, investments, exits, and returns
   - Portfolio companies, investment strategy/thesis
   - Co-investment relationships

3. NETWORK & RELATIONSHIPS
   - Board memberships and advisory roles
   - Professional associations and memberships
   - Conference speaking appearances
   - Political donations (FEC filings)
   - Philanthropic activity

4. PUBLIC PRESENCE & REPUTATION
   - News articles and press mentions
   - Interviews, podcasts, published articles
   - Awards and recognition
   - Social media presence and thought leadership

5. RISK ASSESSMENT
   - SEC or FINRA regulatory actions or filings
   - Litigation, lawsuits, court cases
   - Bankruptcy filings
   - Negative press or controversies
   - Any red flags

CRITICAL IDENTITY RULE:
Many people share similar names. For EVERY finding, verify it belongs to THIS specific person by cross-referencing their company (${company}), title (${title}), and location (${location}). Flag any information where identity is uncertain.

OUTPUT:
- Write detailed narrative paragraphs (not bullet lists)
- Include specific dates, dollar amounts, percentages
- Cite source URLs for every factual claim
- Clearly state when information is not available
- Do NOT fabricate any information`;
}

export async function conductOpenAIDeepResearch(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
  apiKey: string,
): Promise<OpenAIResearchResult> {
  const startTime = Date.now();

  logger.info('OpenAI deep research starting', { name, company });

  const client = new OpenAI({ apiKey });

  const prompt = buildResearchPrompt(name, company, title, location, linkedinUrl);

  const response = await client.responses.create({
    model: 'o4-mini-deep-research',
    input: prompt,
    tools: [
      { type: 'web_search_preview' as const },
    ],
  });

  // Extract text content from the response
  let content = '';
  const citations: string[] = [];

  for (const item of response.output) {
    if (item.type === 'message') {
      for (const block of item.content) {
        if (block.type === 'output_text') {
          content += block.text;
          // Extract annotation URLs as citations
          if ('annotations' in block && Array.isArray(block.annotations)) {
            for (const ann of block.annotations) {
              if (ann.type === 'url_citation' && ann.url) {
                citations.push(ann.url);
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate citations
  const uniqueCitations = [...new Set(citations)];
  const tokensUsed = (response.usage?.total_tokens ?? 0);
  const searchTimeSec = Math.round((Date.now() - startTime) / 1000);

  logger.info('OpenAI deep research completed', {
    name,
    company,
    contentLength: content.length,
    citationCount: uniqueCitations.length,
    tokensUsed,
    searchTimeSec,
    model: response.model,
  });

  return {
    agent: 'openai',
    content,
    citations: uniqueCitations,
    searchTimeSec,
    model: response.model || 'o4-mini-deep-research',
    tokensUsed,
  };
}
