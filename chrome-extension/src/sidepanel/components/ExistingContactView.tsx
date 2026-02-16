import { useSidePanelStore } from '../store';
import { LinkedInPreview } from './LinkedInPreview';
import { MaskedField } from './MaskedField';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { FileText, RefreshCw, Send, Loader2, ShieldCheck } from 'lucide-react';
import { REPORT_CURRENT_THRESHOLD, REPORT_WARNING_THRESHOLD } from '../../shared/constants';

export function ExistingContactView() {
  const profile = useSidePanelStore((s) => s.profile);
  const entityStatus = useSidePanelStore((s) => s.entityStatus);
  const actionLoading = useSidePanelStore((s) => s.actionLoading);

  if (!profile || !entityStatus) return null;

  const report = entityStatus.latest_report;
  const ageDays = report?.age_days ?? 0;

  const ageBadgeVariant = ageDays <= REPORT_CURRENT_THRESHOLD
    ? 'success' as const
    : ageDays <= REPORT_WARNING_THRESHOLD
      ? 'warning' as const
      : 'destructive' as const;

  const isRefreshing = actionLoading.generate_report || actionLoading.refresh_report;
  const isSendingToCRM = actionLoading.send_to_crm;
  const anyLoading = isRefreshing || isSendingToCRM;

  const handleViewReport = () => {
    if (report?.report_id) {
      chrome.runtime.sendMessage({
        type: 'OPEN_REPORT',
        data: { reportId: report.report_id, reportUrl: '' },
      });
    }
  };

  const handleRefreshReport = () => {
    if (anyLoading) return;
    chrome.runtime.sendMessage({
      type: 'GENERATE_REPORT',
      data: { linkedinUrl: profile.profileUrl },
    });
  };

  const handleSendToCRM = () => {
    if (anyLoading) return;
    chrome.runtime.sendMessage({
      type: 'SEND_TO_CRM',
      data: { mode: 'enrich', reportId: report?.report_id, profile },
    });
  };

  return (
    <div className="flex flex-col animate-slide-up">
      <LinkedInPreview profile={profile} />

      {/* Intelligence status */}
      <div className="px-4 py-3 border-t border-border">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold">Intelligence Report</span>
              </div>
              {report && (
                <Badge variant={ageBadgeVariant}>
                  {ageDays === 0 ? 'Today' : `${ageDays}d ago`}
                </Badge>
              )}
            </div>

            {/* Masked contact fields */}
            {entityStatus.canonical_data && (
              <div className="space-y-0.5 mb-3 py-2 px-3 rounded-lg bg-secondary/50">
                <MaskedField label="Email" value={null} masked />
                <MaskedField label="Phone" value={null} masked />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {report && (
                <Button className="w-full h-10" onClick={handleViewReport}>
                  <FileText className="h-4 w-4" />
                  View Report
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={handleRefreshReport} disabled={anyLoading}>
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isRefreshing ? 'Starting...' : report ? 'Refresh' : 'Generate'}
                </Button>
                <Button variant="outline" className="flex-1 h-10" onClick={handleSendToCRM} disabled={anyLoading}>
                  {isSendingToCRM ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSendingToCRM ? 'Sending...' : 'Send to CRM'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
