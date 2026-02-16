// ============================================================
// LinkedIn Extracted Data Types
// ============================================================

export interface LinkedInExperience {
  company: string;
  companyLogoUrl: string | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  location: string | null;
}

export interface LinkedInEducation {
  school: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

export interface LinkedInProfile {
  fullName: string;
  headline: string | null;
  location: string | null;
  profileUrl: string;
  photoUrl: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  connectionCount: string | null;
  about: string | null;
  experiences: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: string[];
  languages: string[];
}

export type LinkedInPageType = 'profile' | 'company' | null;

// ============================================================
// Entity & Intelligence Types
// ============================================================

export interface EntityStatus {
  exists: boolean;
  entity_id: string | null;
  has_report: boolean;
  latest_report: {
    report_id: string;
    generated_at: string;
    age_days: number;
    version: number;
  } | null;
  canonical_data: {
    full_name: string;
    current_title: string | null;
    current_company: string | null;
  } | null;
}

// ============================================================
// Report Types (mirrors the report JSON schema)
// ============================================================

export type EntityType = 'person' | 'company' | 'fund';
export type SourceType = 'news' | 'database' | 'website' | 'profile' | 'sec_filing' | 'press_release';
export type ReportVisibility = 'private' | 'shared' | 'public';

export interface Subject {
  entity_type: EntityType;
  full_name: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  profile_photo_url?: string;
  linkedin_url?: string;
  email?: string;
  phone?: string;
}

export interface Abstract {
  summary: string;
  key_findings: string[];
  relevance_score: number;
  relevance_notes: string;
}

export interface Citation {
  id: number;
  citation_number: string;
  text: string;
  source_title: string;
  source_url: string;
  source_type: SourceType;
  accessed_date: string;
  publication_date?: string;
  author?: string;
  publisher?: string;
}

export interface Subsection {
  subsection_id: string;
  title: string;
  content: string;
  structured_data: Record<string, unknown>;
  citations: Citation[];
}

export interface Section {
  section_id: string;
  section_number: number;
  title: string;
  subsections: Subsection[];
}

export interface Bibliography {
  total_sources: number;
  sources_by_type: Record<string, number>;
  all_sources: Citation[];
}

export interface ReportMetadata {
  generation_time_seconds: number;
  ai_model: string;
  total_tokens: number;
  sources_analyzed: number;
  last_refreshed: string;
  next_suggested_refresh: string;
  quality_score: number;
  completeness_score: number;
  confidence_scores: Record<string, number>;
}

export interface Report {
  report_id: string;
  entity_id: string;
  version: number;
  generated_at: string;
  generated_by_org: string;
  subject: Subject;
  abstract: Abstract;
  sections: Section[];
  bibliography: Bibliography;
  metadata: ReportMetadata;
}

// ============================================================
// Job Status Types
// ============================================================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ReportJob {
  job_id: string;
  status: JobStatus;
  progress: number;
  current_step?: string;
  completed_steps?: string[];
  remaining_steps?: string[];
  started_at?: string;
  estimated_completion?: string;
  report_id?: string;
  report_url?: string;
  completed_at?: string;
  error_message?: string;
}

// ============================================================
// Side Panel State
// ============================================================

export type PanelView =
  | 'unauthenticated'
  | 'loading'
  | 'existing_contact'
  | 'new_contact'
  | 'generating'
  | 'report_success'
  | 'settings'
  | 'not_linkedin';

export interface AuthState {
  token: string;
  userId: string;
  orgId: string;
  email: string;
  expiresAt: number;
}

// ============================================================
// Extension Message Protocol
// ============================================================

export type ExtensionMessage =
  | { type: 'PROFILE_DETECTED'; data: LinkedInProfile }
  | { type: 'PAGE_CHANGED'; data: { pageType: LinkedInPageType; url: string } }
  | { type: 'ENTITY_STATUS_UPDATE'; data: { profile: LinkedInProfile; entityStatus: EntityStatus } }
  | { type: 'GENERATE_REPORT'; data: { linkedinUrl: string } }
  | { type: 'JOB_STATUS_UPDATE'; data: ReportJob }
  | { type: 'OPEN_REPORT'; data: { reportId: string; reportUrl: string } }
  | { type: 'AUTH_TOKEN_UPDATE'; data: AuthState }
  | { type: 'AUTH_REQUIRED'; data: Record<string, never> }
  | { type: 'SIGN_IN'; data: Record<string, never> }
  | { type: 'SIGN_OUT'; data: Record<string, never> }
  | { type: 'SEND_TO_CRM'; data: { mode: 'quick_add' | 'enrich'; reportId?: string; profile?: LinkedInProfile } }
  | { type: 'ERROR'; data: { message: string; code?: ErrorCode; retryAction?: RetryAction } }
  | { type: 'NOT_LINKEDIN'; data: Record<string, never> }
  | { type: 'ACTION_LOADING'; data: { action: ActionType; loading: boolean } }
  | { type: 'CRM_SUCCESS'; data: { message: string } }
  | { type: 'REPORT_COMPLETE'; data: { reportId: string; reportUrl: string; subject: Subject | null } }
  | { type: 'NAVIGATE_SETTINGS'; data: Record<string, never> }
  | { type: 'NAVIGATE_BACK'; data: Record<string, never> };

// ============================================================
// Error Handling Types
// ============================================================

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_EXPIRED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'GENERATION_FAILED'
  | 'CRM_FAILED'
  | 'EXTRACTION_FAILED'
  | 'UNKNOWN';

export type RetryAction =
  | 'RETRY_ENTITY_CHECK'
  | 'RETRY_GENERATE'
  | 'RETRY_CRM'
  | 'SIGN_IN';

export type ActionType =
  | 'generate_report'
  | 'send_to_crm'
  | 'refresh_report'
  | 'quick_add';

export interface AppError {
  message: string;
  code: ErrorCode;
  retryAction?: RetryAction;
  autoDismiss: boolean;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface GenerateReportRequest {
  entity: {
    linkedin_url: string;
    entity_type: EntityType;
    extracted_data: {
      full_name: string;
      headline?: string;
      location?: string;
      current_company?: string;
      current_title?: string;
    };
  };
  options?: {
    priority?: 'normal' | 'high';
    notify_when_complete?: boolean;
  };
}

export interface GenerateReportResponse {
  job_id: string;
  entity_id: string;
  status: JobStatus;
  estimated_time_seconds: number;
}

export interface ScrapeRequest {
  linkedin_url: string;
  entity_type: EntityType;
  extracted_data: LinkedInProfile;
}
