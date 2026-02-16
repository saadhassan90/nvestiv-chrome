import { create } from 'zustand';
import type {
  LinkedInProfile,
  EntityStatus,
  ReportJob,
  AuthState,
  PanelView,
  ExtensionMessage,
  AppError,
  ErrorCode,
  RetryAction,
  ActionType,
  Subject,
} from '../../shared/types';
import { ERROR_AUTO_DISMISS_MS } from '../../shared/constants';

interface SidePanelStore {
  // State
  view: PanelView;
  profile: LinkedInProfile | null;
  entityStatus: EntityStatus | null;
  reportJob: ReportJob | null;
  auth: AuthState | null;
  error: AppError | null;
  isCheckingEntity: boolean;
  actionLoading: Record<ActionType, boolean>;
  successMessage: string | null;

  // Report success state
  completedReportId: string | null;
  completedReportUrl: string | null;
  completedReportSubject: Subject | null;

  // Settings navigation
  previousView: PanelView | null;

  // Actions
  setProfile: (profile: LinkedInProfile) => void;
  setEntityStatus: (status: EntityStatus) => void;
  setReportJob: (job: ReportJob | null) => void;
  setAuth: (auth: AuthState | null) => void;
  setError: (error: AppError | null) => void;
  setNotLinkedIn: () => void;
  setActionLoading: (action: ActionType, loading: boolean) => void;
  setSuccessMessage: (message: string | null) => void;
  clearError: () => void;
  navigateToSettings: () => void;
  navigateBack: () => void;
  reset: () => void;
  handleMessage: (message: ExtensionMessage) => void;
}

let errorDismissTimer: ReturnType<typeof setTimeout> | null = null;
let successDismissTimer: ReturnType<typeof setTimeout> | null = null;

function deriveView(state: {
  auth: AuthState | null;
  profile: LinkedInProfile | null;
  entityStatus: EntityStatus | null;
  reportJob: ReportJob | null;
  isCheckingEntity: boolean;
}): PanelView {
  if (!state.auth) return 'unauthenticated';
  if (!state.profile) return 'loading';
  if (state.reportJob && (state.reportJob.status === 'queued' || state.reportJob.status === 'processing' || state.reportJob.status === 'failed')) {
    return 'generating';
  }
  if (state.isCheckingEntity) return 'loading';
  if (state.entityStatus?.exists) return 'existing_contact';
  return 'new_contact';
}

const initialActionLoading: Record<ActionType, boolean> = {
  generate_report: false,
  send_to_crm: false,
  refresh_report: false,
  quick_add: false,
};

export const useSidePanelStore = create<SidePanelStore>((set, get) => ({
  view: 'loading',
  profile: null,
  entityStatus: null,
  reportJob: null,
  auth: null,
  error: null,
  isCheckingEntity: false,
  actionLoading: { ...initialActionLoading },
  successMessage: null,
  completedReportId: null,
  completedReportUrl: null,
  completedReportSubject: null,
  previousView: null,

  setProfile: (profile) =>
    set((state) => {
      const next = { ...state, profile, entityStatus: null, reportJob: null, error: null, isCheckingEntity: true, successMessage: null, completedReportId: null, completedReportUrl: null, completedReportSubject: null };
      return { ...next, view: deriveView(next) };
    }),

  setEntityStatus: (entityStatus) =>
    set((state) => {
      const next = { ...state, entityStatus, isCheckingEntity: false };
      return { ...next, view: deriveView(next) };
    }),

  setReportJob: (reportJob) =>
    set((state) => {
      const next = { ...state, reportJob };
      const actionLoading = { ...state.actionLoading };
      if (reportJob) {
        actionLoading.generate_report = false;
        actionLoading.refresh_report = false;
      }
      return { ...next, actionLoading, view: deriveView(next) };
    }),

  setAuth: (auth) =>
    set((state) => {
      const next = { ...state, auth };
      return { ...next, view: deriveView(next) };
    }),

  setError: (error) => {
    if (errorDismissTimer) {
      clearTimeout(errorDismissTimer);
      errorDismissTimer = null;
    }
    set({ error, successMessage: null });
    if (error?.autoDismiss) {
      errorDismissTimer = setTimeout(() => {
        const current = get().error;
        if (current === error) {
          set({ error: null });
        }
      }, ERROR_AUTO_DISMISS_MS);
    }
  },

  clearError: () => {
    if (errorDismissTimer) {
      clearTimeout(errorDismissTimer);
      errorDismissTimer = null;
    }
    set({ error: null });
  },

  setNotLinkedIn: () =>
    set({ view: 'not_linkedin', profile: null, entityStatus: null, reportJob: null, error: null, isCheckingEntity: false, successMessage: null, completedReportId: null, completedReportUrl: null, completedReportSubject: null }),

  setActionLoading: (action, loading) =>
    set((state) => ({
      actionLoading: { ...state.actionLoading, [action]: loading },
    })),

  setSuccessMessage: (message) => {
    if (successDismissTimer) {
      clearTimeout(successDismissTimer);
      successDismissTimer = null;
    }
    set({ successMessage: message, error: null });
    if (message) {
      successDismissTimer = setTimeout(() => {
        set({ successMessage: null });
      }, 5000);
    }
  },

  navigateToSettings: () =>
    set((state) => ({
      previousView: state.view,
      view: 'settings',
    })),

  navigateBack: () => {
    const prev = get().previousView;
    if (prev && prev !== 'settings') {
      set({ view: prev, previousView: null });
    } else {
      const current = get();
      set({ view: deriveView(current), previousView: null });
    }
  },

  reset: () =>
    set((state) => ({
      profile: null,
      entityStatus: null,
      reportJob: null,
      error: null,
      isCheckingEntity: false,
      actionLoading: { ...initialActionLoading },
      successMessage: null,
      completedReportId: null,
      completedReportUrl: null,
      completedReportSubject: null,
      previousView: null,
      view: state.auth ? 'loading' : 'unauthenticated',
    })),

  handleMessage: (message) => {
    const store = get();
    switch (message.type) {
      case 'PROFILE_DETECTED':
        store.setProfile(message.data);
        break;
      case 'ENTITY_STATUS_UPDATE':
        store.setEntityStatus(message.data.entityStatus);
        break;
      case 'JOB_STATUS_UPDATE':
        store.setReportJob(message.data);
        break;
      case 'AUTH_TOKEN_UPDATE':
        store.setAuth(message.data);
        break;
      case 'AUTH_REQUIRED':
        store.setAuth(null);
        break;
      case 'NOT_LINKEDIN':
        store.setNotLinkedIn();
        break;
      case 'ERROR': {
        const isCritical = message.data.code === 'AUTH_EXPIRED' || message.data.code === 'GENERATION_FAILED';
        store.setError({
          message: message.data.message,
          code: (message.data.code ?? 'UNKNOWN') as ErrorCode,
          retryAction: message.data.retryAction as RetryAction | undefined,
          autoDismiss: !isCritical,
        });
        break;
      }
      case 'ACTION_LOADING':
        store.setActionLoading(message.data.action, message.data.loading);
        break;
      case 'CRM_SUCCESS':
        store.setSuccessMessage(message.data.message);
        break;
      case 'REPORT_COMPLETE':
        set({
          completedReportId: message.data.reportId,
          completedReportUrl: message.data.reportUrl,
          completedReportSubject: message.data.subject,
          reportJob: null,
          view: 'report_success',
        });
        break;
      case 'NAVIGATE_SETTINGS':
        store.navigateToSettings();
        break;
      case 'NAVIGATE_BACK':
        store.navigateBack();
        break;
    }
  },
}));
