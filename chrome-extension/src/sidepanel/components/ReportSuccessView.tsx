import { useSidePanelStore } from '../store';
import { ProfileCard } from './ProfileCard';
import { MaskedField } from './MaskedField';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { FileText, Send, CheckCircle2, Loader2 } from 'lucide-react';

export function ReportSuccessView() {
  const profile = useSidePanelStore((s) => s.profile);
  const completedReportId = useSidePanelStore((s) => s.completedReportId);
  const completedReportUrl = useSidePanelStore((s) => s.completedReportUrl);
  const completedReportSubject = useSidePanelStore((s) => s.completedReportSubject);
  const actionLoading = useSidePanelStore((s) => s.actionLoading);

  if (!profile) return null;

  const subject = completedReportSubject;
  const isSendingToCRM = actionLoading.send_to_crm;

  const handleViewReport = () => {
    if (completedReportId) {
      chrome.runtime.sendMessage({
        type: 'OPEN_REPORT',
        data: { reportId: completedReportId, reportUrl: completedReportUrl || '' },
      });
    }
  };

  const handleSendToCRM = () => {
    if (isSendingToCRM) return;
    chrome.runtime.sendMessage({
      type: 'SEND_TO_CRM',
      data: { mode: 'enrich', reportId: completedReportId, profile },
    });
  };

  return (
    <div className="flex flex-col animate-slide-up">
      {/* Compact profile */}
      <ProfileCard profile={profile} compact />

      <div className="px-4 py-3 border-t border-border space-y-3">
        {/* Success banner */}
        <div className="flex items-center gap-2.5 rounded-xl bg-success/5 border border-success/20 p-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Report Ready</p>
            <p className="text-xs text-muted-foreground mt-0.5">Intelligence report has been generated successfully.</p>
          </div>
        </div>

        {/* Contact info from report */}
        {subject && (subject.email || subject.phone) && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Details</span>
                <Badge variant="success" className="text-xs">Verified</Badge>
              </div>
              <div className="space-y-0.5">
                {subject.email && <MaskedField label="Email" value={subject.email} masked={false} />}
                {subject.phone && <MaskedField label="Phone" value={subject.phone} masked={false} />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button className="w-full h-10" onClick={handleViewReport}>
            <FileText className="h-4 w-4" />
            View Full Report
          </Button>
          <Button variant="outline" className="w-full h-10" onClick={handleSendToCRM} disabled={isSendingToCRM}>
            {isSendingToCRM ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSendingToCRM ? 'Sending...' : 'Send to CRM'}
          </Button>
        </div>
      </div>
    </div>
  );
}
