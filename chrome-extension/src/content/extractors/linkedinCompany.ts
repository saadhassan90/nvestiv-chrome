/**
 * Extracts company data from a LinkedIn company page.
 * Uses LD+JSON (primary) and DOM selectors (fallback).
 */
export interface LinkedInCompany {
  name: string;
  linkedinUrl: string;
  logoUrl: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  headquarters: string | null;
  founded: string | null;
  specialties: string[];
  website: string | null;
  employeeCount: string | null;
  companyType: string | null;
}

export function extractLinkedInCompany(): LinkedInCompany | null {
  try {
    const ldJsonData = extractCompanyFromLDJSON();
    const domData = extractCompanyFromDOM();

    const company: LinkedInCompany = {
      name: ldJsonData?.name || domData.name || '',
      linkedinUrl: normalizeCompanyUrl(window.location.href),
      logoUrl: domData.logoUrl || ldJsonData?.logoUrl || null,
      tagline: domData.tagline || null,
      description: domData.description || ldJsonData?.description || null,
      industry: domData.industry || null,
      companySize: domData.companySize || null,
      headquarters: domData.headquarters || ldJsonData?.headquarters || null,
      founded: domData.founded || null,
      specialties: domData.specialties,
      website: domData.website || ldJsonData?.website || null,
      employeeCount: domData.employeeCount || null,
      companyType: domData.companyType || null,
    };

    if (!company.name) {
      console.warn('🔵 Nvestiv: Could not extract company name');
      return null;
    }

    return company;
  } catch (error) {
    console.error('🔵 Nvestiv: Failed to extract company:', error);
    return null;
  }
}

// ============================================================
// LD+JSON Extraction
// ============================================================

interface CompanyLDJSON {
  name: string;
  description: string | null;
  headquarters: string | null;
  logoUrl: string | null;
  website: string | null;
}

function extractCompanyFromLDJSON(): CompanyLDJSON | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data['@type'] === 'Organization' || data['@type'] === 'Corporation') {
        return {
          name: data.name || '',
          description: data.description || null,
          headquarters: data.address?.addressLocality || null,
          logoUrl: data.logo?.contentUrl || data.logo || null,
          website: data.url || null,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ============================================================
// DOM Extraction
// ============================================================

interface CompanyDOMResult {
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  headquarters: string | null;
  founded: string | null;
  specialties: string[];
  website: string | null;
  employeeCount: string | null;
  companyType: string | null;
}

function extractCompanyFromDOM(): CompanyDOMResult {
  return {
    name: extractCompanyName(),
    logoUrl: extractCompanyLogo(),
    tagline: extractCompanyTagline(),
    description: extractCompanyDescription(),
    industry: extractDetailField('Industry'),
    companySize: extractDetailField('Company size'),
    headquarters: extractDetailField('Headquarters'),
    founded: extractDetailField('Founded'),
    specialties: extractSpecialties(),
    website: extractDetailField('Website'),
    employeeCount: extractEmployeeCount(),
    companyType: extractDetailField('Type'),
  };
}

function extractCompanyName(): string {
  const selectors = [
    'h1.org-top-card-summary__title span',
    'h1[class*="org-top-card"] span',
    '.org-top-card-summary__title',
    'h1',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return '';
}

function extractCompanyLogo(): string | null {
  const selectors = [
    '.org-top-card-primary-content__logo img',
    'img.org-top-card-primary-content__logo-image',
    'img[class*="org-top-card"]',
  ];

  for (const selector of selectors) {
    const img = document.querySelector(selector) as HTMLImageElement | null;
    if (img?.src && !img.src.includes('ghost')) {
      return img.src;
    }
  }
  return null;
}

function extractCompanyTagline(): string | null {
  const selectors = [
    '.org-top-card-summary__tagline',
    'p[class*="tagline"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return null;
}

function extractCompanyDescription(): string | null {
  const selectors = [
    '.org-about-us-organization-description__text span',
    '.org-page-details__definition-text',
    'p[class*="org-about"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return null;
}

function extractDetailField(label: string): string | null {
  // LinkedIn company "About" section uses dt/dd pairs
  const dts = document.querySelectorAll('dt');
  for (const dt of dts) {
    if (dt.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
      const dd = dt.nextElementSibling;
      if (dd?.tagName === 'DD' && dd.textContent?.trim()) {
        return dd.textContent.trim();
      }
    }
  }

  // Fallback: look for labeled sections with aria-hidden spans
  const headings = document.querySelectorAll('h3, h4');
  for (const heading of headings) {
    if (heading.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
      const sibling = heading.nextElementSibling;
      const span = sibling?.querySelector('span[aria-hidden="true"]') || sibling;
      if (span?.textContent?.trim()) {
        return span.textContent.trim();
      }
    }
  }

  return null;
}

function extractSpecialties(): string[] {
  const text = extractDetailField('Specialties');
  if (!text) return [];
  return text.split(',').map(s => s.trim()).filter(Boolean);
}

function extractEmployeeCount(): string | null {
  const selectors = [
    '.org-top-card-summary-info-list__info-item:last-child',
    'a[href*="employees"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && (text.includes('employee') || text.match(/[\d,]+/))) {
      return text;
    }
  }
  return null;
}

function normalizeCompanyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `https://www.linkedin.com${path}`;
  } catch {
    return url;
  }
}
