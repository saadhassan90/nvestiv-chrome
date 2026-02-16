/**
 * Web Research Service
 *
 * Multi-step research pipeline:
 * 1. Generate identity-anchored search queries
 * 2. Execute searches via Jina Search (s.jina.ai) or fallback
 * 3. Read and extract content from result pages via Jina Reader (r.jina.ai)
 * 4. Compile a research dossier for the LLM to synthesize
 *
 * This approach ensures DEEP research by controlling the search queries
 * ourselves rather than relying on an LLM's lazy web_search_preview.
 */

import { logger } from '../utils/logger.js';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
}

export interface ResearchDossier {
  subject: {
    name: string;
    company: string;
    title: string;
    location: string;
    linkedinUrl: string;
  };
  searchQueries: string[];
  sources: SearchResult[];
  totalContentLength: number;
  searchTime: number;
}

const JINA_API_KEY = process.env.JINA_API_KEY || '';

// Use Jina Search (s.jina.ai) for web search — returns full page content, not just snippets
async function jinaSearch(query: string): Promise<SearchResult[]> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Return-Format': 'json',
  };
  if (JINA_API_KEY) {
    headers.Authorization = `Bearer ${JINA_API_KEY}`;
  }

  try {
    const url = `https://s.jina.ai/${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      logger.warn('Jina search failed', { status: response.status, query });
      return [];
    }

    const data = (await response.json()) as { data?: Array<Record<string, string>> };
    const results: SearchResult[] = [];

    if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        results.push({
          title: item.title || '',
          url: item.url || '',
          content: item.content || item.description || '',
          snippet: item.description || '',
        });
      }
    }

    return results;
  } catch (err) {
    logger.warn('Jina search error', { error: (err as Error).message, query });
    return [];
  }
}

// Fallback: Use Jina Reader (r.jina.ai) to read a specific URL
async function jinaRead(url: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'text/plain',
  };
  if (JINA_API_KEY) {
    headers.Authorization = `Bearer ${JINA_API_KEY}`;
  }

  try {
    const readerUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(readerUrl, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return '';
    }

    const text = await response.text();
    // Truncate very long pages to avoid overwhelming the LLM
    return text.slice(0, 15_000);
  } catch {
    return '';
  }
}

// Fallback search using OpenAI's simple web_search_preview to get URLs,
// then Jina Reader to get full content
async function openaiSearchFallback(query: string, openaiApiKey: string): Promise<SearchResult[]> {
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: openaiApiKey });

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' as const }],
      input: `Search the web for: ${query}\n\nReturn a list of the most relevant URLs you find, one per line. Just URLs, nothing else.`,
      temperature: 0,
      max_output_tokens: 1000,
    });

    // Extract text from response
    let text = '';
    for (const item of response.output) {
      if (item.type === 'message') {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            text += content.text;
          }
        }
      }
    }

    // Extract URLs from the text
    const urlRegex = /https?:\/\/[^\s\])"',]+/g;
    const urls = [...new Set(text.match(urlRegex) || [])].slice(0, 5);

    const results: SearchResult[] = [];
    // Read each URL with Jina Reader in parallel
    const readPromises = urls.map(async (url) => {
      const content = await jinaRead(url);
      if (content) {
        results.push({
          title: url.split('/').pop()?.replace(/-/g, ' ') || url,
          url,
          content,
        });
      }
    });
    await Promise.all(readPromises);

    return results;
  } catch (err) {
    logger.warn('OpenAI fallback search error', { error: (err as Error).message, query });
    return [];
  }
}

/**
 * Generate search queries anchored to the subject's identity.
 * These are the actual web searches we'll run — diverse queries to cover
 * all report sections.
 */
function generateSearchQueries(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
): string[] {
  const queries: string[] = [];

  // Core identity queries
  queries.push(`"${name}" "${company}"`);
  queries.push(`"${name}" "${company}" ${title}`);

  // Professional background
  queries.push(`"${name}" career background experience ${company}`);
  queries.push(`"${name}" education university degree`);

  // Investment activity
  queries.push(`"${name}" investment fund portfolio ${company}`);
  queries.push(`"${name}" deal acquisition merger ${company}`);
  queries.push(`"${name}" AUM assets under management`);

  // Network and relationships
  queries.push(`"${name}" board director advisory ${company}`);
  queries.push(`"${name}" conference speaker panel`);

  // Public presence
  queries.push(`"${name}" interview podcast article ${company}`);
  queries.push(`"${name}" news press release ${company}`);
  queries.push(`"${name}" thought leadership publication`);

  // Risk and regulatory
  queries.push(`"${name}" SEC FINRA regulatory filing`);
  queries.push(`"${name}" litigation lawsuit court`);

  // Location-anchored
  if (location) {
    queries.push(`"${name}" "${company}" ${location}`);
  }

  // Company-specific
  queries.push(`${company} company funding valuation`);
  queries.push(`site:crunchbase.com "${name}" OR "${company}"`);

  // LinkedIn profile (try to read it directly)
  if (linkedinUrl) {
    queries.push(`site:linkedin.com "${name}" ${company}`);
  }

  // Filter out queries with empty fields
  return queries.filter(q => !q.includes('""'));
}

/**
 * Conduct multi-step web research on a subject.
 * Returns a compiled dossier of all found information.
 */
export async function conductResearch(
  name: string,
  company: string,
  title: string,
  location: string,
  linkedinUrl: string,
  openaiApiKey: string,
): Promise<ResearchDossier> {
  const startTime = Date.now();
  const queries = generateSearchQueries(name, company, title, location, linkedinUrl);

  logger.info('Starting web research', {
    name,
    company,
    queryCount: queries.length,
  });

  const allSources: Map<string, SearchResult> = new Map();
  const hasJinaKey = !!JINA_API_KEY;

  // Execute searches in batches to respect rate limits
  const BATCH_SIZE = hasJinaKey ? 2 : 2;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (query) => {
      let results: SearchResult[] = [];

      if (hasJinaKey) {
        results = await jinaSearch(query);
      }

      // If Jina didn't return results, use OpenAI fallback
      if (results.length === 0) {
        results = await openaiSearchFallback(query, openaiApiKey);
      }

      return results;
    });

    const batchResults = await Promise.all(batchPromises);

    for (const results of batchResults) {
      for (const result of results) {
        // Deduplicate by URL
        if (!allSources.has(result.url) && result.content.length > 100) {
          allSources.set(result.url, result);
        }
      }
    }

    // Small delay between batches to be nice to APIs
    if (i + BATCH_SIZE < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // If we only have OpenAI fallback results (no Jina key), also try to
  // read the LinkedIn profile directly
  if (linkedinUrl) {
    const linkedinContent = await jinaRead(linkedinUrl);
    if (linkedinContent && linkedinContent.length > 200) {
      allSources.set(linkedinUrl, {
        title: `LinkedIn Profile - ${name}`,
        url: linkedinUrl,
        content: linkedinContent,
      });
    }
  }

  const sources = Array.from(allSources.values());
  const totalContentLength = sources.reduce((acc, s) => acc + s.content.length, 0);
  const searchTime = Math.round((Date.now() - startTime) / 1000);

  logger.info('Web research completed', {
    name,
    company,
    queriesExecuted: queries.length,
    sourcesFound: sources.length,
    totalContentLength,
    searchTimeSec: searchTime,
    hasJinaKey,
  });

  return {
    subject: { name, company, title, location, linkedinUrl },
    searchQueries: queries,
    sources,
    totalContentLength,
    searchTime,
  };
}

/**
 * Format the research dossier into a text block that can be fed to the LLM.
 * Truncates to stay within token limits.
 */
export function formatDossierForLLM(dossier: ResearchDossier, maxChars: number = 200_000): string {
  let output = `WEB RESEARCH DOSSIER FOR: ${dossier.subject.name}
Company: ${dossier.subject.company}
Title: ${dossier.subject.title}
Location: ${dossier.subject.location}
LinkedIn: ${dossier.subject.linkedinUrl}
Sources Found: ${dossier.sources.length}
Search Queries Used: ${dossier.searchQueries.length}

═══════════════════════════════════════════════════════════════
SOURCE MATERIALS (${dossier.sources.length} sources)
═══════════════════════════════════════════════════════════════

`;

  // Truncate each source to 5K chars to keep the dossier diverse rather than dominated by a few long sources
  const MAX_SOURCE_CHARS = 5_000;

  let charCount = output.length;
  for (let i = 0; i < dossier.sources.length; i++) {
    const source = dossier.sources[i];
    const truncatedContent = source.content.length > MAX_SOURCE_CHARS
      ? source.content.slice(0, MAX_SOURCE_CHARS) + '\n[... content truncated ...]'
      : source.content;
    const block = `
────────────────────────────────────────
SOURCE ${i + 1}: ${source.title}
URL: ${source.url}
────────────────────────────────────────
${truncatedContent}

`;
    if (charCount + block.length > maxChars) {
      output += `\n[... ${dossier.sources.length - i} additional sources truncated for token limit ...]`;
      break;
    }
    output += block;
    charCount += block.length;
  }

  return output;
}
