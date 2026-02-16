import { useSidePanelStore } from '../store';
import { LinkedInPreview } from './LinkedInPreview';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Sparkles, UserPlus, Loader2, Zap } from 'lucide-react';

export function NewContactView() {
  const profile = useSidePanelStore((s) => s.profile);
  const actionLoading = useSidePanelStore((s) => s.actionLoading);

  if (!profile) return null;

  const isGenerating = actionLoading.generate_report;
  const isAddingToCRM = actionLoading.quick_add;
  const anyLoading = isGenerating || isAddingToCRM;

  const handleGenerateReport = () => {
    if (anyLoading) return;
    chrome.runtime.sendMessage({
      type: 'GENERATE_REPORT',
      data: { linkedinUrl: profile.profileUrl },
    });
  };

  const handleQuickAdd = () => {
    if (anyLoading) return;
    chrome.runtime.sendMessage({
      type: 'SEND_TO_CRM',
      data: { mode: 'quick_add', profile },
    });
  };

  return (
    <div className="flex flex-col animate-slide-up">
      <LinkedInPreview profile={profile} />

      <div className="px-4 py-3 border-t border-border">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-brand-muted" />
              <span className="text-xs font-medium text-muted-foreground">New contact — no intelligence data</span>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="w-full h-10" onClick={handleGenerateReport} disabled={anyLoading}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? 'Starting...' : 'Generate Intelligence Report'}
              </Button>
              <Button variant="outline" className="w-full h-10" onClick={handleQuickAdd} disabled={anyLoading}>
                {isAddingToCRM ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {isAddingToCRM ? 'Adding...' : 'Quick Add to CRM'}
              </Button>
            </div>

            {/* Hint */}
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border">
              <Zap className="h-3.5 w-3.5 text-brand mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate a report to uncover contact details, professional background, and investment connections.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
