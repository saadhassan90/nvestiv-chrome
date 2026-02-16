import { logger } from '../utils/logger.js';

type CRMEntityType =
  | 'CRM_investor_individual'
  | 'CRM_investor_company'
  | 'CRM_manager'
  | 'CRM_startup'
  | 'CRM_people'
  | 'CRM_generic_company';

interface ReportSubject {
  entity_type: string;
  full_name: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  email?: string;
  phone?: string;
}

interface ReportAbstract {
  relevance_score: number;
  summary: string;
}

interface CRMData {
  entity_type: CRMEntityType;
  fields: Record<string, unknown>;
}

// Investor-related keywords in titles/roles
const INVESTOR_KEYWORDS = [
  'investor', 'venture', 'capital', 'partner', 'managing director',
  'portfolio', 'fund', 'private equity', 'vc', 'lp', 'gp',
  'allocation', 'endowment', 'family office', 'hedge fund',
  'angel', 'seed', 'series',
];

const MANAGER_KEYWORDS = [
  'fund manager', 'asset manager', 'portfolio manager',
  'investment manager', 'wealth manager', 'general partner',
];

const STARTUP_KEYWORDS = [
  'founder', 'co-founder', 'ceo', 'cto', 'startup',
  'pre-seed', 'series a', 'series b',
];

function detectCRMEntityType(
  subject: ReportSubject,
  _reportContent: Record<string, unknown>,
): CRMEntityType {
  const title = (subject.current_title || '').toLowerCase();
  const company = (subject.current_company || '').toLowerCase();
  const isPerson = subject.entity_type === 'person';
  const isCompany = subject.entity_type === 'company';

  // Check for investor keywords
  const isInvestor = INVESTOR_KEYWORDS.some(
    (kw) => title.includes(kw) || company.includes(kw),
  );

  const isManager = MANAGER_KEYWORDS.some(
    (kw) => title.includes(kw) || company.includes(kw),
  );

  const isStartup = STARTUP_KEYWORDS.some(
    (kw) => title.includes(kw) || company.includes(kw),
  );

  if (isPerson && isInvestor) return 'CRM_investor_individual';
  if (isPerson && isStartup) return 'CRM_people'; // founders as people for now
  if (isPerson) return 'CRM_people';

  if (isCompany && isInvestor) return 'CRM_investor_company';
  if (isCompany && isManager) return 'CRM_manager';
  if (isCompany && isStartup) return 'CRM_startup';
  if (isCompany) return 'CRM_generic_company';

  return isPerson ? 'CRM_people' : 'CRM_generic_company';
}

function parseLocation(location?: string): {
  city?: string;
  state?: string;
  country?: string;
} {
  if (!location) return {};

  const parts = location.split(',').map((s) => s.trim());
  if (parts.length >= 3) {
    return { city: parts[0], state: parts[1], country: parts[2] };
  }
  if (parts.length === 2) {
    // Could be "City, State" or "City, Country"
    const second = parts[1];
    if (second.length === 2) {
      return { city: parts[0], state: second, country: 'United States' };
    }
    return { city: parts[0], country: second };
  }
  return { city: parts[0] };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function mapPersonFields(
  subject: ReportSubject,
  abstract: ReportAbstract,
): Record<string, unknown> {
  const { firstName, lastName } = splitName(subject.full_name);
  const location = parseLocation(subject.location);

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: subject.full_name,
    email: subject.email,
    phone: subject.phone,
    title: subject.current_title,
    company: subject.current_company,
    city: location.city,
    state: location.state,
    country: location.country,
    description: abstract.summary,
    priority_level: abstract.relevance_score >= 70 ? 'high' : abstract.relevance_score >= 40 ? 'medium' : 'low',
    source: 'nvestiv_intelligence',
    linkedin_url: (subject as unknown as Record<string, unknown>).linkedin_url,
  };
}

function mapCompanyFields(
  subject: ReportSubject,
  abstract: ReportAbstract,
): Record<string, unknown> {
  const location = parseLocation(subject.location);

  return {
    company_name: subject.full_name,
    city: location.city,
    state: location.state,
    country: location.country,
    description: abstract.summary,
    priority_level: abstract.relevance_score >= 70 ? 'high' : abstract.relevance_score >= 40 ? 'medium' : 'low',
    source: 'nvestiv_intelligence',
  };
}

export function mapReportToCRM(
  subject: ReportSubject,
  abstract: ReportAbstract,
  reportContent: Record<string, unknown>,
): CRMData {
  const entityType = detectCRMEntityType(subject, reportContent);

  const isPerson = subject.entity_type === 'person';
  const baseFields = isPerson
    ? mapPersonFields(subject, abstract)
    : mapCompanyFields(subject, abstract);

  logger.info('CRM mapping completed', { entityType, subjectName: subject.full_name });

  return {
    entity_type: entityType,
    fields: baseFields,
  };
}
