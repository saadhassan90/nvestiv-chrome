import { useSidePanelStore } from '../store';
import { ProfileCard } from './ProfileCard';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export function GeneratingView() {
  const profile = useSidePanelStore((s) => s.profile);
  const reportJob = useSidePanelStore((s) => s.reportJob);

  if (!profile) return null;

  const progress = reportJob?.progress ?? 0;
  const currentStep = reportJob?.current_step ?? 'Queued...';
  const completedSteps = reportJob?.completed_steps ?? [];
  const remainingSteps = reportJob?.remaining_steps ?? [];
  const isFailed = reportJob?.status === 'failed';

  const handleRetry = () => {
    chrome.runtime.sendMessage({
      type: 'GENERATE_REPORT',
      data: { linkedinUrl: profile.profileUrl },
    });
  };

  return (
    <div className="flex flex-col animate-slide-up">
      {/* Compact profile card */}
      <ProfileCard profile={profile} compact />

      <div className="px-4 py-3 border-t border-border">
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {isFailed ? 'Generation Failed' : 'Generating Report'}
              </span>
              {isFailed ? (
                <Badge variant="destructive">Failed</Badge>
              ) : (
                <Badge variant="secondary" className="font-mono">{Math.round(progress)}%</Badge>
              )}
            </div>

            {isFailed ? (
              <>
                <div className="flex items-start gap-2.5 rounded-xl bg-destructive/5 border border-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive leading-relaxed">
                    {reportJob?.error_message || 'An error occurred during report generation.'}
                  </p>
                </div>
                <Button variant="outline" className="w-full h-10" onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </>
            ) : (
              <>
                {/* Progress bar */}
                <Progress value={progress} className="h-2" />

                {/* Current step */}
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span className="text-xs font-medium text-foreground">{currentStep}</span>
                </div>

                {/* Steps list */}
                <div className="space-y-1.5">
                  {completedSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 text-brand" />
                      </div>
                      <span className="text-xs text-muted-foreground">{step}</span>
                    </div>
                  ))}

                  {remainingSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                      <span className="text-xs text-muted-foreground/50">{step}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
