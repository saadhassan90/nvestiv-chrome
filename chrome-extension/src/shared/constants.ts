// API base URL - configurable per environment
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
export const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173';
export const REPORTS_URL = import.meta.env.VITE_REPORTS_URL || 'http://localhost:3000';

// Auth
export const AUTH_EXTENSION_URL = `${MAIN_APP_URL}/auth/extension`;
export const TOKEN_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours before expiry

// Polling
export const JOB_POLL_INTERVAL_MS = 3000; // 3 seconds
export const ENTITY_CHECK_DEBOUNCE_MS = 500;

// Report age thresholds (days)
export const REPORT_CURRENT_THRESHOLD = 7;
export const REPORT_WARNING_THRESHOLD = 30;

// Extension marker for testing
export const EXTENSION_LOADED_MARKER = '__nvestivContentScriptLoaded';

// Error handling
export const ERROR_AUTO_DISMISS_MS = 8000; // Auto-dismiss non-critical errors after 8s
export const API_TIMEOUT_MS = 15000; // 15s timeout for regular API calls
export const API_GENERATE_TIMEOUT_MS = 30000; // 30s timeout for report generation trigger
export const API_MAX_RETRIES = 2; // Max retry attempts for failed API calls
export const API_RETRY_BASE_DELAY_MS = 1000; // Base delay for exponential backoff
export const JOB_POLL_MAX_FAILURES = 5; // Stop polling after 5 consecutive failures
export const JOB_POLL_FAILURE_BACKOFF_MS = 5000; // Extra delay per failure
