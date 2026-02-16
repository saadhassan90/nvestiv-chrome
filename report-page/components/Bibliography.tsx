'use client';

import type { Bibliography as BibliographyType, Citation, Section } from '@/lib/types';

interface BibliographyProps {
  bibliography: BibliographyType;
  sections?: Section[];
}

/**
 * Collect all unique citations from section subsections.
 */
function collectInlineCitations(sections: Section[]): Citation[] {
  const citationMap = new Map<number, Citation>();

  for (const section of sections) {
    for (const sub of section.subsections) {
      for (const cit of sub.citations) {
        if (!citationMap.has(cit.id)) {
          citationMap.set(cit.id, cit);
        }
      }
    }
  }

  return Array.from(citationMap.values()).sort((a, b) => a.id - b.id);
}

/**
 * Normalize a bibliography source entry.
 */
function normalizeBibSource(source: unknown, index: number): Citation | null {
  if (typeof source === 'string') {
    const url = source.startsWith('http') ? source : '';
    if (!url) return null;
    return {
      id: index + 1,
      citation_number: `[${index + 1}]`,
      text: '',
      source_title: url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || url,
      source_url: url,
      source_type: 'website',
      accessed_date: new Date().toISOString().split('T')[0],
    };
  }

  if (typeof source === 'object' && source !== null) {
    const s = source as Record<string, unknown>;
    return {
      id: (s.id as number) ?? index + 1,
      citation_number: (s.citation_number as string) ?? `[${index + 1}]`,
      text: (s.text as string) ?? '',
      source_title: (s.source_title as string) ?? '',
      source_url: (s.source_url as string) ?? '',
      source_type: (s.source_type as Citation['source_type']) ?? 'website',
      accessed_date: (s.accessed_date as string) ?? '',
      publication_date: s.publication_date as string | undefined,
      author: s.author as string | undefined,
      publisher: s.publisher as string | undefined,
    };
  }

  return null;
}

function isInferredCitation(source: Citation, sections?: Section[]): boolean {
  if (!sections) return false;
  for (const section of sections) {
    for (const sub of section.subsections) {
      if (sub.confidence_level === 'uncertain') {
        for (const cit of sub.citations) {
          if (cit.id === source.id) return true;
        }
      }
    }
  }
  return false;
}

export function Bibliography({ bibliography, sections }: BibliographyProps) {
  let sources: Citation[];

  if (sections && sections.length > 0) {
    const inlineCitations = collectInlineCitations(sections);
    if (inlineCitations.length > 0) {
      sources = inlineCitations;
    } else {
      sources = bibliography.all_sources
        .map((s, i) => normalizeBibSource(s, i))
        .filter((s): s is Citation => s !== null);
    }
  } else {
    sources = bibliography.all_sources
      .map((s, i) => normalizeBibSource(s, i))
      .filter((s): s is Citation => s !== null);
  }

  return (
    <section id="bibliography" className="mt-20 pt-8 border-t border-slate-200 scroll-mt-24">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
        References &amp; Citations
      </h4>
      <p className="text-xs text-slate-500 mb-6">
        {bibliography.total_sources} sources{' · '}
        {Object.entries(bibliography.sources_by_type)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => `${count} ${type}`)
          .join(' · ')}
      </p>

      <ul className="space-y-3">
        {sources.map((source, i) => {
          const inferred = isInferredCitation(source, sections);
          const citNum = source.id ?? i + 1;

          return (
            <li
              key={citNum}
              id={`cit-${citNum}`}
              className="flex gap-3 text-xs text-slate-500 leading-relaxed scroll-mt-24"
            >
              <span
                className={`font-mono font-bold shrink-0 px-1 rounded h-fit ${
                  inferred
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-slate-900 bg-slate-100'
                }`}
              >
                [{citNum}]
              </span>
              <span>
                {source.author && <>{source.author}. </>}
                {source.source_title && (
                  <>&ldquo;{source.source_title}&rdquo;</>
                )}
                {source.publisher && <>, {source.publisher}</>}
                {source.publication_date && <>, {source.publication_date}</>}
                .{' '}
                {source.source_url && (
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-600 break-all underline decoration-dotted underline-offset-2"
                  >
                    {source.source_url}
                  </a>
                )}
                {source.accessed_date && (
                  <> (accessed {source.accessed_date})</>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
