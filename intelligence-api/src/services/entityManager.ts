import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

interface LinkedInExtractedData {
  fullName: string;
  headline?: string | null;
  location?: string | null;
  profileUrl: string;
  photoUrl?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  connectionCount?: string | null;
  about?: string | null;
  experiences?: Array<{
    company: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
    location?: string | null;
  }>;
  education?: Array<{
    school: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
}

export interface EntityRecord {
  id: string;
  linkedin_url: string;
  entity_type: 'person' | 'company';
  canonical_data: Record<string, unknown>;
  last_scraped_at: string;
  scraped_by_count: number;
  total_reports: number;
  latest_report_id: string | null;
  latest_report_at: string | null;
  created_at: string;
  updated_at: string;
  org_id: string;
}

export const entityManager = {
  async findByLinkedInUrl(linkedinUrl: string): Promise<EntityRecord | null> {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Entity lookup failed', { error: error.message, linkedinUrl });
      throw error;
    }

    return data;
  },

  async upsertFromScrape(
    linkedinUrl: string,
    entityType: 'person' | 'company',
    extractedData: LinkedInExtractedData,
    orgId: string,
  ): Promise<EntityRecord> {
    const existing = await this.findByLinkedInUrl(linkedinUrl);

    const canonicalData = {
      full_name: extractedData.fullName,
      headline: extractedData.headline,
      location: extractedData.location,
      photo_url: extractedData.photoUrl,
      current_company: extractedData.currentCompany,
      current_title: extractedData.currentTitle,
      connection_count: extractedData.connectionCount,
      about: extractedData.about,
      experiences: extractedData.experiences,
      education: extractedData.education,
      skills: extractedData.skills,
      certifications: extractedData.certifications,
      languages: extractedData.languages,
    };

    if (existing) {
      // Merge: preserve email/phone from previous reports, update scraped fields
      const existingData = (existing.canonical_data ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = {
        ...existingData,
        ...canonicalData,
      };

      // Preserve email/phone if existing has them and new scrape doesn't
      if (existingData.email) {
        merged.email = existingData.email;
      }
      if (existingData.phone) {
        merged.phone = existingData.phone;
      }

      const { data, error } = await supabase
        .from('entities')
        .update({
          canonical_data: merged,
          last_scraped_at: new Date().toISOString(),
          scraped_by_count: existing.scraped_by_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      logger.info('Entity updated from scrape', { entityId: existing.id, linkedinUrl });
      return data;
    }

    // Create new entity
    const { data, error } = await supabase
      .from('entities')
      .insert({
        linkedin_url: linkedinUrl,
        entity_type: entityType,
        canonical_data: canonicalData,
        last_scraped_at: new Date().toISOString(),
        scraped_by_count: 1,
        total_reports: 0,
        org_id: orgId,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('New entity created from scrape', { entityId: data.id, linkedinUrl });
    return data;
  },

  async updateFromReport(
    entityId: string,
    reportId: string,
    reportData: Record<string, unknown>,
  ): Promise<void> {
    const existing = await supabase
      .from('entities')
      .select('canonical_data, total_reports')
      .eq('id', entityId)
      .single();

    if (existing.error) throw existing.error;

    // Merge report data (higher quality, AI-synthesized)
    const merged = {
      ...existing.data.canonical_data,
      ...reportData,
    };

    const { error } = await supabase
      .from('entities')
      .update({
        canonical_data: merged,
        latest_report_id: reportId,
        latest_report_at: new Date().toISOString(),
        total_reports: (existing.data.total_reports || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entityId);

    if (error) throw error;

    // Create version record
    await supabase.from('entity_versions').insert({
      entity_id: entityId,
      version_data: merged,
      change_source: 'report',
      report_id: reportId,
    });

    logger.info('Entity updated from report', { entityId, reportId });
  },

  async getEntityStatus(linkedinUrl: string) {
    const entity = await this.findByLinkedInUrl(linkedinUrl);

    if (!entity) {
      return {
        exists: false,
        entity_id: null,
        has_report: false,
        latest_report: null,
        canonical_data: null,
      };
    }

    let latestReport = null;
    if (entity.latest_report_id) {
      const { data: report } = await supabase
        .from('reports')
        .select('id, generated_at, version')
        .eq('id', entity.latest_report_id)
        .single();

      if (report) {
        const ageDays = Math.floor(
          (Date.now() - new Date(report.generated_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        latestReport = {
          report_id: report.id,
          generated_at: report.generated_at,
          age_days: ageDays,
          version: report.version,
        };
      }
    }

    return {
      exists: true,
      entity_id: entity.id,
      has_report: !!entity.latest_report_id,
      latest_report: latestReport,
      canonical_data: {
        full_name: (entity.canonical_data as Record<string, unknown>).full_name as string,
        current_title: (entity.canonical_data as Record<string, unknown>).current_title as string | null,
        current_company: (entity.canonical_data as Record<string, unknown>).current_company as string | null,
      },
    };
  },
};
