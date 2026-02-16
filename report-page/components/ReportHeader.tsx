'use client';

import { useState } from 'react';
import type { ReportRecord } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { NvestivLogomark } from './NvestivLogo';
import { MaterialIcon } from './MaterialIcon';

interface ReportHeaderProps {
  report: ReportRecord;
}

export function ReportHeader({ report }: ReportHeaderProps) {
  const [crmStatus, setCrmStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading'>('idle');

  const handlePrint = () => window.print();

  const handleRefresh = async () => {
    setRefreshStatus('loading');
    try {
      const response = await fetch(`/api/report/${report.id}/refresh`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json() as { report_url?: string };
        if (data.report_url) {
          window.location.href = data.report_url;
        } else {
          window.location.reload();
        }
      }
    } catch {
      setRefreshStatus('idle');
    }
  };

  const handleSendToCRM = async () => {
    setCrmStatus('loading');
    try {
      const response = await fetch(`/api/report/${report.id}/crm`, { method: 'POST' });
      if (response.ok) {
        setCrmStatus('success');
        setTimeout(() => setCrmStatus('idle'), 3000);
      } else {
        setCrmStatus('error');
        setTimeout(() => setCrmStatus('idle'), 3000);
      }
    } catch {
      setCrmStatus('error');
      setTimeout(() => setCrmStatus('idle'), 3000);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 no-print">
      {/* Left: Logo + label */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <NvestivLogomark className="w-8 h-8 shrink-0" />
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <span className="text-sm font-medium text-slate-600 hidden sm:inline">Research Dossier</span>
      </div>

      {/* Right: Age badge + action buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Last updated badge — hidden on small screens */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Last Updated: {formatDate(report.generated_at)}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshStatus === 'loading'}
          className="btn btn-ghost h-9 w-9 p-0 rounded-full"
          title="Refresh report"
        >
          <MaterialIcon
            name="refresh"
            className={`text-[18px] text-slate-500 ${refreshStatus === 'loading' ? 'animate-spin' : ''}`}
          />
        </button>

        {/* Send to CRM */}
        <button
          onClick={handleSendToCRM}
          disabled={crmStatus === 'loading' || crmStatus === 'success'}
          className="btn btn-outline h-9 gap-2"
          title="Send to CRM"
        >
          <MaterialIcon
            name={crmStatus === 'success' ? 'check' : crmStatus === 'loading' ? 'sync' : 'share'}
            className={`text-[18px] ${crmStatus === 'success' ? 'text-emerald-600' : crmStatus === 'loading' ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">
            {crmStatus === 'success' ? 'Sent' : 'Share'}
          </span>
        </button>

        {/* Export / Print */}
        <button
          onClick={handlePrint}
          className="btn btn-primary h-9 gap-2"
          title="Export as PDF"
        >
          <MaterialIcon name="download" className="text-[18px]" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
