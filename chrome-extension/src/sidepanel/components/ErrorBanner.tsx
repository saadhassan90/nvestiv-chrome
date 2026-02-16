import { useSidePanelStore } from '../store';
import { AlertCircle, WifiOff, Clock, ShieldAlert, RefreshCw, LogIn, X, CheckCircle2 } from 'lucide-react';
import type { ErrorCode, RetryAction } from '../../shared/types';

const errorIcons: Record<ErrorCode, typeof AlertCircle> = {
  NETWORK_ERROR: WifiOff,
  AUTH_EXPIRED: ShieldAlert,
  RATE_LIMITED: Clock,
  SERVER_ERROR: AlertCircle,
  TIMEOUT: Clock,
  GENERATION_FAILED: AlertCircle,
  CRM_FAILED: AlertCircle,
  EXTRACTION_FAILED: AlertCircle,
  UNKNOWN: AlertCircle,
};

function retryLabel(action: RetryAction): string {
  switch (action) {
    case 'RETRY_ENTITY_CHECK': return 'Retry';
    case 'RETRY_GENERATE': return 'Try Again';
    case 'RETRY_CRM': return 'Retry';
    case 'SIGN_IN': return 'Sign In';
  }
}

function handleRetry(action: RetryAction): void {
  switch (action) {
    case 'SIGN_IN':
      chrome.runtime.sendMessage({ type: 'SIGN_IN', data: {} });
      break;
    case 'RETRY_GENERATE':
    case 'RETRY_ENTITY_CHECK':
    case 'RETRY_CRM':
      // These will be handled by reloading - the user can click the action button again
      break;
  }
}

export function ErrorBanner() {
  const error = useSidePanelStore((s) => s.error);
  const clearError = useSidePanelStore((s) => s.clearError);
  const successMessage = useSidePanelStore((s) => s.successMessage);
  const setSuccessMessage = useSidePanelStore((s) => s.setSuccessMessage);

  // Success banner
  if (successMessage) {
    return (
      <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-xs text-green-700 flex-1">{successMessage}</p>
        <button onClick={() => setSuccessMessage(null)} className="shrink-0">
          <X className="h-3.5 w-3.5 text-green-400 hover:text-green-600" />
        </button>
      </div>
    );
  }

  if (!error) return null;

  const Icon = errorIcons[error.code] ?? AlertCircle;
  const RetryIcon = error.retryAction === 'SIGN_IN' ? LogIn : RefreshCw;

  return (
    <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <Icon className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-destructive">{error.message}</p>
        {error.retryAction && (
          <button
            onClick={() => {
              handleRetry(error.retryAction!);
              clearError();
            }}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:text-destructive/80 underline underline-offset-2"
          >
            <RetryIcon className="h-3 w-3" />
            {retryLabel(error.retryAction)}
          </button>
        )}
      </div>
      <button onClick={clearError} className="shrink-0">
        <X className="h-3.5 w-3.5 text-destructive/60 hover:text-destructive" />
      </button>
    </div>
  );
}
