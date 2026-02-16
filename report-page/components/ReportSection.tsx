'use client';

import type { Section, Subsection } from '@/lib/types';

interface ReportSectionProps {
  section: Section;
}

function renderContentWithCitations(content: string): React.ReactNode {
  // Replace [N] citations with clickable citation chips
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const num = match[1];
      return (
        <a key={i} href={`#cit-${num}`} className="citation-chip">
          {num}
        </a>
      );
    }
    return part;
  });
}

function SubsectionView({ subsection }: { subsection: Subsection }) {
  const isInferred = subsection.confidence_level === 'uncertain' || subsection.confidence_level === 'likely';
  const isUncertain = subsection.confidence_level === 'uncertain';
  const blockClass = isUncertain ? 'confidence-block-inferred' : 'confidence-block-verified';

  return (
    <div className={blockClass}>
      {/* Subsection title + badge */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h4 className="text-base font-sans font-semibold text-slate-900">
          {subsection.title}
        </h4>
        {isInferred && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
              isUncertain
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {subsection.confidence_level}
          </span>
        )}
      </div>

      {/* Confidence note */}
      {subsection.confidence_note && isInferred && (
        <p className="text-xs font-sans italic text-slate-500 mb-3 pl-3 border-l-2 border-slate-200">
          {subsection.confidence_note}
        </p>
      )}

      {/* Body text */}
      <div className="report-body-text">
        {subsection.content.split('\n\n').map((paragraph, i) => (
          <p key={i} className={i < subsection.content.split('\n\n').length - 1 ? 'mb-4' : ''}>
            {renderContentWithCitations(paragraph)}
          </p>
        ))}
      </div>

      {/* Structured data table */}
      {Object.keys(subsection.structured_data).length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  {Object.keys(subsection.structured_data).map((key) => (
                    <th key={key}>{key.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(subsection.structured_data).map((value, idx) => (
                    <td key={idx} className="text-slate-600">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportSection({ section }: ReportSectionProps) {
  return (
    <section id={section.section_id} className="timeline-section scroll-mt-24">
      <div className="timeline-dot" />
      <h3 className="text-xl font-sans font-bold text-slate-900 mb-6 tracking-tight">
        {section.title}
      </h3>
      <div className="space-y-6">
        {section.subsections.map((sub) => (
          <SubsectionView key={sub.subsection_id} subsection={sub} />
        ))}
      </div>
    </section>
  );
}
