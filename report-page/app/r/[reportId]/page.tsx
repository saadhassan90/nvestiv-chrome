import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import type { ReportRecord } from '@/lib/types';
import { ReportHeader } from '@/components/ReportHeader';
import { ReportView } from '@/components/ReportView';

interface Props {
  params: { reportId: string };
}

export async function generateMetadata({ params }: Props) {
  const { data: report } = await supabaseServer
    .from('reports')
    .select('subject')
    .eq('id', params.reportId)
    .single();

  if (!report) return { title: 'Report Not Found' };

  return {
    title: `${report.subject.full_name} - Nvestiv Intelligence Report`,
    description: `Intelligence report for ${report.subject.full_name}`,
  };
}

export default async function ReportPage({ params }: Props) {
  const { data: report, error } = await supabaseServer
    .from('reports')
    .select('*')
    .eq('id', params.reportId)
    .single();

  if (error || !report) {
    notFound();
  }

  const typedReport = report as unknown as ReportRecord;

  // Increment view count (fire-and-forget)
  supabaseServer
    .from('reports')
    .update({ view_count: (typedReport.view_count || 0) + 1 })
    .eq('id', params.reportId)
    .then(() => {});

  return (
    <>
      <ReportHeader report={typedReport} />
      <ReportView report={typedReport.report_content} generatedAt={typedReport.generated_at} />
    </>
  );
}
