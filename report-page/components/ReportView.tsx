'use client';

import type { ReportContent } from '@/lib/types';
import { ReportSection } from './ReportSection';
import { Bibliography } from './Bibliography';
import { StatCard } from './StatCard';
import { ConfidenceGauge } from './ConfidenceGauge';
import { SidebarNav } from './SidebarNav';
import { MaterialIcon } from './MaterialIcon';
// utils imported in child components as needed

interface ReportViewProps {
  report: ReportContent;
  generatedAt: string;
}

function SubjectHeader({ report, generatedAt }: ReportViewProps) {
  const { subject, abstract } = report;

  return (
    <div className="mb-12 pb-8 border-b border-slate-200">
      {/* Top row: badges + metadata */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div className="space-y-4">
          {/* Entity type + verification badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-900">
              {subject.entity_type === 'person'
                ? 'Person of Interest'
                : subject.entity_type === 'company'
                  ? 'Company'
                  : 'Fund'}
            </span>
            {abstract.identity_confidence === 'confirmed' && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <MaterialIcon name="verified" className="text-[16px] text-sky-500" filled />
                Verified Entity
              </span>
            )}
          </div>

          {/* Name + title */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-sans font-bold text-slate-900 tracking-tight mb-2">
              {subject.full_name}
            </h1>
            {subject.current_title && (
              <p className="text-lg text-slate-500 font-light">
                {subject.current_title}
                {subject.current_company && (
                  <>
                    {' at '}
                    <span className="text-slate-900 font-medium">{subject.current_company}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Detail pills: location, education, identity markers */}
      <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-600">
        {subject.location && (
          <div className="flex items-center gap-2.5">
            <MaterialIcon name="location_on" className="text-slate-400 text-[20px]" />
            {subject.location}
          </div>
        )}
        {subject.current_company && (
          <div className="flex items-center gap-2.5">
            <MaterialIcon name="domain" className="text-slate-400 text-[20px]" />
            {subject.current_company}
          </div>
        )}
        {subject.identity_markers && subject.identity_markers.length > 0 && (
          <div className="flex items-center gap-2.5">
            <MaterialIcon name="school" className="text-slate-400 text-[20px]" />
            {subject.identity_markers.slice(0, 3).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutiveAbstract({ report }: { report: ReportContent }) {
  const { abstract, metadata } = report;

  // Count subsections by confidence
  let confirmedCount = 0;
  let inferredCount = 0;
  for (const section of report.sections) {
    for (const sub of section.subsections) {
      if (sub.confidence_level === 'uncertain' || sub.confidence_level === 'likely') {
        inferredCount++;
      } else {
        confirmedCount++;
      }
    }
  }

  return (
    <section id="executive-summary" className="mb-16 scroll-mt-24">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section header with confidence legend */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MaterialIcon name="summarize" className="text-slate-500 text-[18px]" />
            Executive Abstract
          </h2>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-900" />
              <span className="text-slate-500 font-medium">Verified ({confirmedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-500 font-medium">Inferred ({inferredCount})</span>
            </div>
          </div>
        </div>

        {/* Summary text */}
        <div className="p-5 sm:p-6 lg:p-8">
          <p className="report-body-text mb-8 text-slate-700">
            {abstract.summary}
          </p>

          {/* Key findings stat cards */}
          {abstract.key_findings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {abstract.key_findings.slice(0, 4).map((finding, i) => (
                <StatCard
                  key={i}
                  label={`Finding ${i + 1}`}
                  value={finding}
                />
              ))}
            </div>
          )}

          {/* Relevance score */}
          {abstract.relevance_score > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
              <span className="text-slate-500">
                Relevance Score:{' '}
                <strong className="text-slate-900">{abstract.relevance_score}/100</strong>
              </span>
              {abstract.relevance_notes && (
                <span className="text-xs text-slate-400 italic">
                  {abstract.relevance_notes}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportFooter({ report, generatedAt }: ReportViewProps) {
  const { metadata, bibliography } = report;

  return (
    <footer className="mt-16 py-8 border-t border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <ConfidenceGauge
          score={metadata.quality_score}
          totalSources={bibliography.total_sources}
        />
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500">
            &copy; {new Date(generatedAt).getFullYear()} Nvestiv Intelligence. Private &amp; Confidential.
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {metadata.ai_model} &middot; {metadata.generation_time_seconds}s &middot;
            Quality {metadata.quality_score}/100 &middot; Completeness {metadata.completeness_score}/100
          </p>
        </div>
      </div>
    </footer>
  );
}

export function ReportView({ report, generatedAt }: ReportViewProps) {
  return (
    <div className="pt-16 min-h-screen flex flex-col lg:flex-row max-w-report mx-auto">
      {/* Sidebar navigation — hidden on mobile */}
      <SidebarNav report={report} />

      {/* Main content */}
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-10 xl:pr-16 max-w-content">
        {/* Subject header */}
        <SubjectHeader report={report} generatedAt={generatedAt} />

        {/* Executive abstract */}
        <ExecutiveAbstract report={report} />

        {/* Timeline sections */}
        <div className="grid gap-16 relative">
          {report.sections.map((section) => (
            <ReportSection key={section.section_id} section={section} />
          ))}
        </div>

        {/* Bibliography */}
        <Bibliography bibliography={report.bibliography} sections={report.sections} />

        {/* Footer */}
        <ReportFooter report={report} generatedAt={generatedAt} />
      </main>
    </div>
  );
}
