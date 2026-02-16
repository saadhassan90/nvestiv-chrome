import type { ExtensionMessage, LinkedInProfile, EntityStatus, ErrorCode, RetryAction, ActionType } from '../shared/types';
import {
  API_BASE_URL,
  MAIN_APP_URL,
  REPORTS_URL,
  API_TIMEOUT_MS,
  API_GENERATE_TIMEOUT_MS,
  API_MAX_RETRIES,
  API_RETRY_BASE_DELAY_MS,
  JOB_POLL_MAX_FAILURES,
  JOB_POLL_FAILURE_BACKOFF_MS,
} from '../shared/constants';

console.log('🟢 Nvestiv: Background worker started at', new Date().toISOString());

// ============================================================
// Side Panel Setup
// ============================================================

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ============================================================
// Fetch with Timeout & Retry
// ============================================================

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: ErrorCode,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function classifyError(error: unknown): { message: string; code: ErrorCode } {
  if (error instanceof ApiError) {
    return { message: error.message, code: error.code };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return { message: 'Request timed out. Please try again.', code: 'TIMEOUT' };
  }

  if (error instanceof TypeError && (
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('net::')
  )) {
    return { message: 'Network error. Check your connection and try again.', code: 'NETWORK_ERROR' };
  }

  const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { message: msg, code: 'UNKNOWN' };
}

function classifyHttpStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'AUTH_EXPIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Session expired. Please sign in again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Server error. Our team has been notified. Please try again later.';
  return `Request failed (${status}). Please try again.`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  {
    timeoutMs = API_TIMEOUT_MS,
    maxRetries = API_MAX_RETRIES,
    retryOn = [408, 429, 500, 502, 503, 504],
  } = {},
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok || !retryOn.includes(response.status) || attempt === maxRetries) {
        return response;
      }

      // Wait before retrying with exponential backoff
      const delay = API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`🟡 Retry ${attempt + 1}/${maxRetries} for ${url} in ${delay}ms (status: ${response.status})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error;

      // Don't retry on abort (timeout) - likely a persistent issue
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) throw error;

      const delay = API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`🟡 Retry ${attempt + 1}/${maxRetries} for ${url} in ${delay}ms (error: ${error})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================
// Message Handler
// ============================================================

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    console.log('📨 Background received:', message.type, 'from:', sender.tab ? 'content script' : 'extension');

    switch (message.type) {
      case 'PROFILE_DETECTED':
        handleProfileDetected(message.data, sender.tab?.id);
        break;

      case 'PAGE_CHANGED':
        handlePageChanged(message.data, sender.tab?.id);
        break;

      case 'SIGN_IN':
        handleSignIn();
        break;

      case 'SIGN_OUT':
        handleSignOut();
        break;

      case 'GENERATE_REPORT':
        handleGenerateReport(message.data);
        break;

      case 'OPEN_REPORT':
        handleOpenReport(message.data);
        break;

      case 'SEND_TO_CRM':
        handleSendToCRM(message.data);
        break;

      default:
        console.log('📨 Unhandled message type:', message.type);
    }

    sendResponse({ received: true });
    return true;
  },
);

// ============================================================
// Profile Detection Handler
// ============================================================

async function handleProfileDetected(
  profile: LinkedInProfile,
  tabId?: number,
): Promise<void> {
  // 1. Forward profile to side panel immediately for instant preview
  broadcastToExtension({
    type: 'PROFILE_DETECTED',
    data: profile,
  });

  // 2. Enable side panel for this tab
  if (tabId) {
    chrome.sidePanel.setOptions({
      tabId,
      enabled: true,
    }).catch(console.error);
  }

  // 3. In parallel: check entity status + store scraped data
  const token = await getAuthToken();
  if (!token) {
    broadcastToExtension({ type: 'AUTH_REQUIRED', data: {} });
    return;
  }

  try {
    const [entityStatusResult] = await Promise.allSettled([
      checkEntityExists(profile.profileUrl, token),
      storeScrapedData(profile, token),
    ]);

    if (entityStatusResult.status === 'fulfilled') {
      broadcastToExtension({
        type: 'ENTITY_STATUS_UPDATE',
        data: {
          profile,
          entityStatus: entityStatusResult.value,
        },
      });
    } else {
      const { message, code } = classifyError(entityStatusResult.reason);
      console.error('🔴 Entity check failed:', entityStatusResult.reason);

      // On auth errors, prompt re-auth instead of showing a generic error
      if (code === 'AUTH_EXPIRED') {
        await handleTokenExpired();
        return;
      }

      broadcastToExtension({
        type: 'ERROR',
        data: {
          message: `Could not check intelligence status: ${message}`,
          code,
          retryAction: 'RETRY_ENTITY_CHECK' as RetryAction,
        },
      });
    }
  } catch (error) {
    console.error('🔴 Profile detection handler error:', error);
  }
}

function handlePageChanged(
  data: { pageType: string | null; url: string },
  tabId?: number,
): void {
  if (!data.pageType) {
    broadcastToExtension({ type: 'NOT_LINKEDIN', data: {} });
  }

  if (tabId) {
    chrome.sidePanel.setOptions({
      tabId,
      enabled: data.pageType === 'profile' || data.pageType === 'company',
    }).catch(console.error);
  }
}

// ============================================================
// Auth Handlers
// ============================================================

async function handleSignIn(): Promise<void> {
  const authUrl = `${MAIN_APP_URL}/auth/extension`;
  chrome.tabs.create({ url: authUrl });
}

async function handleSignOut(): Promise<void> {
  await chrome.storage.local.remove(['auth_token', 'token_expires', 'user_id', 'org_id', 'email']);
  broadcastToExtension({ type: 'AUTH_REQUIRED', data: {} });
}

async function handleTokenExpired(): Promise<void> {
  await chrome.storage.local.remove(['auth_token', 'token_expires']);
  broadcastToExtension({ type: 'AUTH_REQUIRED', data: {} });
  broadcastToExtension({
    type: 'ERROR',
    data: {
      message: 'Your session has expired. Please sign in again.',
      code: 'AUTH_EXPIRED' as ErrorCode,
      retryAction: 'SIGN_IN' as RetryAction,
    },
  });
}

// ============================================================
// Report Generation Handler
// ============================================================

async function handleGenerateReport(
  data: { linkedinUrl: string },
): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    broadcastToExtension({ type: 'AUTH_REQUIRED', data: {} });
    return;
  }

  // Signal loading state to side panel
  broadcastToExtension({
    type: 'ACTION_LOADING',
    data: { action: 'generate_report' as ActionType, loading: true },
  });

  try {
    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/intelligence/generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity: {
            linkedin_url: data.linkedinUrl,
            entity_type: 'person',
            extracted_data: {},
          },
        }),
      },
      { timeoutMs: API_GENERATE_TIMEOUT_MS },
    );

    if (!response.ok) {
      const code = classifyHttpStatus(response.status);
      if (code === 'AUTH_EXPIRED') {
        await handleTokenExpired();
        return;
      }
      throw new ApiError(userMessageForStatus(response.status), response.status, code);
    }

    const result = await response.json() as { job_id: string };
    pollJobStatus(result.job_id, token);
  } catch (error) {
    const { message, code } = classifyError(error);
    console.error('🔴 Report generation failed:', error);
    broadcastToExtension({
      type: 'ERROR',
      data: {
        message: `Report generation failed: ${message}`,
        code,
        retryAction: 'RETRY_GENERATE' as RetryAction,
      },
    });
  } finally {
    broadcastToExtension({
      type: 'ACTION_LOADING',
      data: { action: 'generate_report' as ActionType, loading: false },
    });
  }
}

// ============================================================
// Open Report Handler
// ============================================================

function handleOpenReport(data: { reportId: string; reportUrl: string }): void {
  const url = data.reportUrl || `${REPORTS_URL}/r/${data.reportId}`;
  chrome.tabs.create({ url });
}

// ============================================================
// Send to CRM Handler
// ============================================================

async function handleSendToCRM(
  data: { mode: 'quick_add' | 'enrich'; reportId?: string; profile?: LinkedInProfile },
): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    broadcastToExtension({ type: 'AUTH_REQUIRED', data: {} });
    return;
  }

  const actionType: ActionType = data.mode === 'quick_add' ? 'quick_add' : 'send_to_crm';
  broadcastToExtension({
    type: 'ACTION_LOADING',
    data: { action: actionType, loading: true },
  });

  try {
    if (data.mode === 'enrich' && data.reportId) {
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/intelligence/crm/enrich`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ report_id: data.reportId }),
        },
      );

      if (!response.ok) {
        const code = classifyHttpStatus(response.status);
        if (code === 'AUTH_EXPIRED') { await handleTokenExpired(); return; }
        throw new ApiError(userMessageForStatus(response.status), response.status, code);
      }

      broadcastToExtension({
        type: 'CRM_SUCCESS',
        data: { message: 'Intelligence data has been synced to your CRM.' },
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('src/assets/icons/icon128.png'),
        title: 'Sent to CRM',
        message: 'Intelligence data has been synced to your CRM.',
      });
    } else if (data.mode === 'quick_add' && data.profile) {
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/intelligence/entity/scrape`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkedin_url: data.profile.profileUrl,
            entity_type: 'person',
            extracted_data: data.profile,
          }),
        },
      );

      if (!response.ok) {
        const code = classifyHttpStatus(response.status);
        if (code === 'AUTH_EXPIRED') { await handleTokenExpired(); return; }
        throw new ApiError(userMessageForStatus(response.status), response.status, code);
      }

      broadcastToExtension({
        type: 'CRM_SUCCESS',
        data: { message: `${data.profile.fullName} has been added to your contacts.` },
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('src/assets/icons/icon128.png'),
        title: 'Added to CRM',
        message: `${data.profile.fullName} has been added to your contacts.`,
      });
    }
  } catch (error) {
    const { message, code } = classifyError(error);
    console.error('🔴 Send to CRM failed:', error);
    broadcastToExtension({
      type: 'ERROR',
      data: {
        message: `CRM sync failed: ${message}`,
        code,
        retryAction: 'RETRY_CRM' as RetryAction,
      },
    });
  } finally {
    broadcastToExtension({
      type: 'ACTION_LOADING',
      data: { action: actionType, loading: false },
    });
  }
}

// ============================================================
// Job Status Polling (with failure tracking)
// ============================================================

interface StoredJobData {
  jobId: string;
  token: string;
  consecutiveFailures: number;
}

async function pollJobStatus(jobId: string, token: string): Promise<void> {
  const alarmName = `poll_job_${jobId}`;

  await chrome.storage.local.set({
    [`active_job_${jobId}`]: { jobId, token, consecutiveFailures: 0 } satisfies StoredJobData,
  });

  chrome.alarms.create(alarmName, { periodInMinutes: 0.05 });

  // Immediate check
  await checkJobStatus(jobId, token, 0);
}

async function checkJobStatus(jobId: string, token: string, consecutiveFailures: number): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/intelligence/status/${jobId}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
      API_TIMEOUT_MS,
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        chrome.alarms.clear(`poll_job_${jobId}`);
        await chrome.storage.local.remove(`active_job_${jobId}`);
        await handleTokenExpired();
        return;
      }
      throw new Error(`Status check failed: ${response.status}`);
    }

    const status = await response.json() as {
      status: string;
      report_url?: string;
      job_id: string;
      progress?: number;
      current_step?: string;
      completed_steps?: string[];
      remaining_steps?: string[];
      report_id?: string;
      error_message?: string;
    };

    // Reset failure count on success
    await chrome.storage.local.set({
      [`active_job_${jobId}`]: { jobId, token, consecutiveFailures: 0 } satisfies StoredJobData,
    });

    broadcastToExtension({ type: 'JOB_STATUS_UPDATE', data: status as ExtensionMessage extends { type: 'JOB_STATUS_UPDATE'; data: infer D } ? D : never });

    if (status.status === 'completed') {
      chrome.alarms.clear(`poll_job_${jobId}`);
      await chrome.storage.local.remove(`active_job_${jobId}`);

      // Navigate side panel to success view with report data
      const subjectData = (status as Record<string, unknown>).subject as
        | { email?: string; phone?: string; full_name?: string; current_title?: string; current_company?: string; location?: string; profile_photo_url?: string; linkedin_url?: string; entity_type?: string }
        | null
        | undefined;

      broadcastToExtension({
        type: 'REPORT_COMPLETE',
        data: {
          reportId: status.report_id || '',
          reportUrl: status.report_url || '',
          subject: subjectData ? {
            entity_type: (subjectData.entity_type as 'person' | 'company' | 'fund') || 'person',
            full_name: subjectData.full_name || '',
            current_title: subjectData.current_title,
            current_company: subjectData.current_company,
            location: subjectData.location,
            profile_photo_url: subjectData.profile_photo_url,
            linkedin_url: subjectData.linkedin_url,
            email: subjectData.email,
            phone: subjectData.phone,
          } : null,
        },
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('src/assets/icons/icon128.png'),
        title: 'Report Ready',
        message: 'Your intelligence report has been generated.',
      });
    } else if (status.status === 'failed') {
      chrome.alarms.clear(`poll_job_${jobId}`);
      await chrome.storage.local.remove(`active_job_${jobId}`);

      broadcastToExtension({
        type: 'ERROR',
        data: {
          message: status.error_message || 'Report generation failed. Please try again.',
          code: 'GENERATION_FAILED' as ErrorCode,
          retryAction: 'RETRY_GENERATE' as RetryAction,
        },
      });
    }
  } catch (error) {
    const newFailureCount = consecutiveFailures + 1;
    console.error(`🔴 Job status check failed (${newFailureCount}/${JOB_POLL_MAX_FAILURES}):`, error);

    if (newFailureCount >= JOB_POLL_MAX_FAILURES) {
      // Stop polling after too many consecutive failures
      chrome.alarms.clear(`poll_job_${jobId}`);
      await chrome.storage.local.remove(`active_job_${jobId}`);

      broadcastToExtension({
        type: 'ERROR',
        data: {
          message: 'Lost connection to report generation. The report may still be processing — check back shortly.',
          code: 'NETWORK_ERROR' as ErrorCode,
          retryAction: 'RETRY_GENERATE' as RetryAction,
        },
      });
    } else {
      // Update failure count for next poll
      await chrome.storage.local.set({
        [`active_job_${jobId}`]: { jobId, token, consecutiveFailures: newFailureCount } satisfies StoredJobData,
      });
    }
  }
}

// Handle alarm events for job polling
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('poll_job_')) {
    const jobId = alarm.name.replace('poll_job_', '');
    const stored = await chrome.storage.local.get(`active_job_${jobId}`);
    const jobData = stored[`active_job_${jobId}`] as StoredJobData | undefined;
    if (jobData) {
      // Add extra delay if we've had failures (backoff)
      if (jobData.consecutiveFailures > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, jobData.consecutiveFailures * JOB_POLL_FAILURE_BACKOFF_MS),
        );
      }
      await checkJobStatus(jobData.jobId, jobData.token, jobData.consecutiveFailures);
    }
  }
});

// ============================================================
// API Helpers
// ============================================================

async function getAuthToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(['auth_token', 'token_expires']);
  const token = result.auth_token as string | undefined;
  if (!token) return null;

  const expires = result.token_expires as number | undefined;
  if (expires && Date.now() > expires) {
    return null;
  }

  return token;
}

async function checkEntityExists(
  linkedinUrl: string,
  token: string,
): Promise<EntityStatus> {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/api/intelligence/exists?entity=${encodeURIComponent(linkedinUrl)}`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );

  if (!response.ok) {
    const code = classifyHttpStatus(response.status);
    throw new ApiError(userMessageForStatus(response.status), response.status, code);
  }

  return response.json() as Promise<EntityStatus>;
}

async function storeScrapedData(
  profile: LinkedInProfile,
  token: string,
): Promise<void> {
  try {
    await fetchWithTimeout(
      `${API_BASE_URL}/api/intelligence/entity/scrape`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedin_url: profile.profileUrl,
          entity_type: 'person',
          extracted_data: profile,
        }),
      },
      API_TIMEOUT_MS,
    );
  } catch (error) {
    // Fire-and-forget: don't block on scrape storage failures
    console.warn('🟡 Scrape storage failed (non-critical):', error);
  }
}

// ============================================================
// Broadcast Helper
// ============================================================

function broadcastToExtension(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open; this is expected
  });
}

// ============================================================
// Listen for auth messages from main app tab
// ============================================================

chrome.runtime.onMessageExternal?.addListener(
  async (message: Record<string, unknown>, _sender, sendResponse) => {
    if (message.type === 'AUTH_SUCCESS') {
      const token = message.token as string;
      const expiresAt = message.expires_at as number;
      const userId = message.user_id as string;
      const orgId = message.org_id as string;
      const email = message.email as string;

      await chrome.storage.local.set({
        auth_token: token,
        token_expires: expiresAt,
        user_id: userId,
        org_id: orgId,
        email,
      });

      broadcastToExtension({
        type: 'AUTH_TOKEN_UPDATE',
        data: { token, userId, orgId, email, expiresAt },
      });

      sendResponse({ success: true });
    }
  },
);

// ============================================================
// Cleanup stale job data on startup
// ============================================================

(async () => {
  try {
    const all = await chrome.storage.local.get(null);
    const staleKeys = Object.keys(all).filter((k) => k.startsWith('active_job_'));
    if (staleKeys.length > 0) {
      console.log('🟡 Cleaning up stale job data:', staleKeys);
      await chrome.storage.local.remove(staleKeys);
      // Clear any lingering alarms
      for (const key of staleKeys) {
        const jobId = key.replace('active_job_', '');
        chrome.alarms.clear(`poll_job_${jobId}`);
      }
    }
  } catch (error) {
    console.warn('🟡 Startup cleanup failed (non-critical):', error);
  }
})();
