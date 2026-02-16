import type {
  LinkedInProfile,
  LinkedInExperience,
  LinkedInEducation,
} from '../../shared/types';

/**
 * Extracts comprehensive profile data from a LinkedIn profile page.
 * Uses multiple strategies for resilience against DOM changes:
 * 1. LD+JSON structured data (most stable)
 * 2. DOM selectors with fallbacks
 */
export function extractLinkedInProfile(): LinkedInProfile | null {
  try {
    // Strategy 1: Try LD+JSON first (most reliable)
    const ldJsonData = extractFromLDJSON();

    // Strategy 2: DOM extraction (more comprehensive but fragile)
    const domData = extractFromDOM();

    // Merge: prefer LD+JSON for basic fields, DOM for extended fields
    const profile: LinkedInProfile = {
      fullName: ldJsonData?.fullName || domData.fullName || '',
      headline: domData.headline || ldJsonData?.headline || null,
      location: domData.location || ldJsonData?.location || null,
      profileUrl: normalizeProfileUrl(window.location.href),
      photoUrl: domData.photoUrl || ldJsonData?.photoUrl || null,
      currentCompany: domData.currentCompany || null,
      currentTitle: domData.currentTitle || null,
      connectionCount: domData.connectionCount || null,
      about: domData.about || null,
      experiences: domData.experiences,
      education: domData.education,
      skills: domData.skills,
      certifications: [],
      languages: [],
    };

    // Validate we have at minimum a name
    if (!profile.fullName) {
      console.warn('🔵 Nvestiv: Could not extract profile name');
      return null;
    }

    return profile;
  } catch (error) {
    console.error('🔵 Nvestiv: Failed to extract profile:', error);
    return null;
  }
}

// ============================================================
// LD+JSON Extraction (Most Stable)
// ============================================================

interface LDJSONResult {
  fullName: string;
  headline: string | null;
  location: string | null;
  photoUrl: string | null;
}

function extractFromLDJSON(): LDJSONResult | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data['@type'] === 'Person') {
        return {
          fullName: data.name || '',
          headline: data.jobTitle || null,
          location: data.address?.addressLocality || null,
          photoUrl: data.image?.contentUrl || data.image || null,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ============================================================
// DOM Extraction (More Comprehensive)
// ============================================================

interface DOMExtractionResult {
  fullName: string;
  headline: string | null;
  location: string | null;
  photoUrl: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  connectionCount: string | null;
  about: string | null;
  experiences: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
}

function extractFromDOM(): DOMExtractionResult {
  return {
    fullName: extractName(),
    headline: extractHeadline(),
    location: extractLocation(),
    photoUrl: extractProfilePhoto(),
    currentCompany: extractCurrentCompany(),
    currentTitle: extractCurrentTitle(),
    connectionCount: extractConnectionCount(),
    about: extractAbout(),
    experiences: extractExperiences(),
    education: extractEducation(),
    skills: extractSkills(),
  };
}

function extractName(): string {
  // Multiple selector strategies for resilience
  const selectors = [
    'h1.text-heading-xlarge',
    'h1[class*="text-heading"]',
    '.pv-text-details__left-panel h1',
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

function extractHeadline(): string | null {
  const selectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '[data-generated-suggestion-target]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return null;
}

function extractLocation(): string | null {
  const selectors = [
    '.text-body-small.inline.t-black--light.break-words',
    '.pv-text-details__left-panel .text-body-small',
    'span.text-body-small[class*="t-black--light"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && !text.includes('connection') && !text.includes('follower')) {
      return text;
    }
  }
  return null;
}

function extractProfilePhoto(): string | null {
  const selectors = [
    '.pv-top-card-profile-picture__image',
    'img.pv-top-card-profile-picture__image--show',
    '.profile-photo-edit__preview',
    'img[class*="profile-photo"]',
  ];

  for (const selector of selectors) {
    const img = document.querySelector(selector) as HTMLImageElement | null;
    if (img?.src && !img.src.includes('ghost')) {
      return img.src;
    }
  }
  return null;
}

function extractCurrentCompany(): string | null {
  // Try to get from headline parsing
  const headline = extractHeadline();
  if (headline) {
    const atMatch = headline.match(/(?:at|@)\s+(.+?)(?:\s*[|·•]|$)/i);
    if (atMatch) return atMatch[1].trim();
  }

  // Try experience section - first current position
  const experienceSection = document.querySelector('#experience');
  if (experienceSection) {
    const container = experienceSection.closest('section');
    const firstEntry = container?.querySelector('.pvs-list__paged-list-item');
    if (firstEntry) {
      const spans = firstEntry.querySelectorAll('span[aria-hidden="true"]');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && !text.includes('·') && text.length > 1 && text.length < 100) {
          return text;
        }
      }
    }
  }
  return null;
}

function extractCurrentTitle(): string | null {
  const headline = extractHeadline();
  if (headline) {
    // "Partner at Sequoia Capital" -> "Partner"
    const atMatch = headline.match(/^(.+?)\s+(?:at|@)\s+/i);
    if (atMatch) return atMatch[1].trim();

    // "Partner | Sequoia Capital" -> "Partner"
    const pipeMatch = headline.match(/^(.+?)\s*[|·•]\s*/);
    if (pipeMatch) return pipeMatch[1].trim();

    // No separator - the whole headline might be the title
    return headline;
  }
  return null;
}

function extractConnectionCount(): string | null {
  const selectors = [
    '.pv-top-card--list-bullet .t-bold',
    'span.t-bold:not(.text-heading-xlarge)',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.trim();
      if (text && (text.includes('connection') || text.includes('follower') || text.match(/\d+\+?/))) {
        return text;
      }
    }
  }
  return null;
}

function extractAbout(): string | null {
  // Look for the About section
  const aboutSection = document.querySelector('#about');
  if (aboutSection) {
    const container = aboutSection.closest('section');
    const contentDiv = container?.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]') ||
      container?.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
      container?.querySelector('.display-flex span[aria-hidden="true"]');
    if (contentDiv?.textContent?.trim()) {
      return contentDiv.textContent.trim();
    }
  }
  return null;
}

function extractExperiences(): LinkedInExperience[] {
  const experiences: LinkedInExperience[] = [];
  const experienceSection = document.querySelector('#experience');
  if (!experienceSection) return experiences;

  const container = experienceSection.closest('section');
  const items = container?.querySelectorAll('.pvs-list__paged-list-item') || [];

  for (const item of items) {
    try {
      const spans = item.querySelectorAll('span[aria-hidden="true"]');
      const texts = Array.from(spans).map(s => s.textContent?.trim()).filter(Boolean) as string[];

      if (texts.length < 2) continue;

      // LinkedIn experience items typically have: title, company, date range, location
      const experience: LinkedInExperience = {
        title: texts[0] || '',
        company: texts[1] || '',
        companyLogoUrl: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        description: null,
        location: null,
      };

      // Parse date range (e.g., "Jan 2020 - Present · 5 yrs")
      for (const text of texts) {
        if (text.includes(' - ') || text.includes('Present')) {
          const dateParts = text.split(' · ')[0];
          const [start, end] = dateParts.split(' - ').map(s => s.trim());
          experience.startDate = start || null;
          experience.endDate = end === 'Present' ? null : end || null;
          experience.isCurrent = text.includes('Present');
        }
      }

      // Get company logo
      const img = item.querySelector('img') as HTMLImageElement | null;
      if (img?.src && !img.src.includes('ghost')) {
        experience.companyLogoUrl = img.src;
      }

      experiences.push(experience);
    } catch {
      continue;
    }
  }

  return experiences.slice(0, 10); // Limit to 10 most recent
}

function extractEducation(): LinkedInEducation[] {
  const educationList: LinkedInEducation[] = [];
  const educationSection = document.querySelector('#education');
  if (!educationSection) return educationList;

  const container = educationSection.closest('section');
  const items = container?.querySelectorAll('.pvs-list__paged-list-item') || [];

  for (const item of items) {
    try {
      const spans = item.querySelectorAll('span[aria-hidden="true"]');
      const texts = Array.from(spans).map(s => s.textContent?.trim()).filter(Boolean) as string[];

      if (texts.length < 1) continue;

      const education: LinkedInEducation = {
        school: texts[0] || '',
        degree: texts[1] || null,
        fieldOfStudy: texts[2] || null,
        startDate: null,
        endDate: null,
        description: null,
      };

      // Parse dates from texts
      for (const text of texts) {
        const dateMatch = text.match(/(\d{4})\s*-\s*(\d{4})/);
        if (dateMatch) {
          education.startDate = dateMatch[1];
          education.endDate = dateMatch[2];
        }
      }

      educationList.push(education);
    } catch {
      continue;
    }
  }

  return educationList.slice(0, 5);
}

function extractSkills(): string[] {
  const skills: string[] = [];
  const skillsSection = document.querySelector('#skills');
  if (!skillsSection) return skills;

  const container = skillsSection.closest('section');
  const items = container?.querySelectorAll('.pvs-list__paged-list-item') || [];

  for (const item of items) {
    const span = item.querySelector('span[aria-hidden="true"]');
    const text = span?.textContent?.trim();
    if (text && text.length < 60) {
      skills.push(text);
    }
  }

  return skills.slice(0, 20);
}

// ============================================================
// Utilities
// ============================================================

function normalizeProfileUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query params and hash, normalize path
    const path = parsed.pathname.replace(/\/+$/, '');
    return `https://www.linkedin.com${path}`;
  } catch {
    return url;
  }
}
