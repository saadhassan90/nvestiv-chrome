export type SourceType = 'news' | 'database' | 'website' | 'profile' | 'sec_filing' | 'press_release';

export type ConfidenceLevel = 'confirmed' | 'likely' | 'uncertain';

export interface Subject {
  entity_type: 'person' | 'company' | 'fund';
  full_name: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  profile_photo_url?: string;
  linkedin_url?: string;
  email?: string;
  phone?: string;
  identity_markers?: string[];
}

export interface Abstract {
  summary: string;
  key_findings: string[];
  relevance_score: number;
  relevance_notes: string;
  identity_confidence?: ConfidenceLevel;
  identity_notes?: string;
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
  confidence_level?: ConfidenceLevel;
  confidence_note?: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all_sources: any[]; // LLM may return Citation objects OR plain URL strings
}

export interface ReportMetadata {
  generation_time_seconds: number;
  ai_model: string;
  total_tokens: number;
  sources_analyzed: number;
  quality_score: number;
  completeness_score: number;
  confidence_scores: Record<string, number>;
}

export interface ReportContent {
  subject: Subject;
  abstract: Abstract;
  sections: Section[];
  bibliography: Bibliography;
  metadata: ReportMetadata;
}

export interface ReportRecord {
  id: string;
  entity_id: string;
  version: number;
  generated_at: string;
  generated_by_org: string;
  report_content: ReportContent;
  subject: Subject;
  abstract: Abstract;
  bibliography: Bibliography;
  metadata: ReportMetadata;
  view_count: number;
  visibility: 'private' | 'shared' | 'public';
  created_at: string;
}
