import { EXTENSION_LOADED_MARKER, ENTITY_CHECK_DEBOUNCE_MS } from '../shared/constants';
import type { LinkedInPageType, ExtensionMessage } from '../shared/types';
import { extractLinkedInProfile } from './extractors/linkedinProfile';
import { extractLinkedInCompany } from './extractors/linkedinCompany';

// Mark content script as loaded (used by tests)
(window as unknown as Record<string, unknown>)[EXTENSION_LOADED_MARKER] = true;

console.log('🔵 Nvestiv: Content script loaded on', window.location.href);

// ============================================================
// Page Type Detection
// ============================================================

function detectPageType(url: string): LinkedInPageType {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.match(/^\/in\/[^/]+/)) return 'profile';
    if (parsed.pathname.match(/^\/company\/[^/]+/)) return 'company';
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Profile & Company Extraction
// ============================================================

function sendMessage(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Background worker may not be active yet; this is expected
  });
}

const EXTRACTION_MAX_RETRIES = 2;
const EXTRACTION_RETRY_DELAY_MS = 2000;

function handleProfilePage(attempt = 0): void {
  try {
    const profile = extractLinkedInProfile();
    if (profile) {
      console.log('🔵 Nvestiv: Profile extracted:', profile.fullName);
      sendMessage({ type: 'PROFILE_DETECTED', data: profile });
    } else if (attempt < EXTRACTION_MAX_RETRIES) {
      // DOM may not be fully loaded yet - retry
      console.log(`🔵 Nvestiv: Profile extraction returned null, retrying (${attempt + 1}/${EXTRACTION_MAX_RETRIES})...`);
      setTimeout(() => handleProfilePage(attempt + 1), EXTRACTION_RETRY_DELAY_MS);
    } else {
      console.warn('🔵 Nvestiv: Profile extraction failed after retries');
      sendMessage({
        type: 'ERROR',
        data: { message: 'Could not extract profile data. Try scrolling down and refreshing.', code: 'EXTRACTION_FAILED' },
      });
    }
  } catch (error) {
    console.error('🔵 Nvestiv: Profile extraction error:', error);
    if (attempt < EXTRACTION_MAX_RETRIES) {
      setTimeout(() => handleProfilePage(attempt + 1), EXTRACTION_RETRY_DELAY_MS);
    }
  }
}

function handleCompanyPage(attempt = 0): void {
  try {
    const company = extractLinkedInCompany();
    if (company) {
      console.log('🔵 Nvestiv: Company extracted:', company.name);
      sendMessage({
        type: 'PROFILE_DETECTED',
        data: {
          fullName: company.name,
          headline: company.tagline,
          location: company.headquarters,
          profileUrl: company.linkedinUrl,
          photoUrl: company.logoUrl,
          currentCompany: company.name,
          currentTitle: company.industry,
          connectionCount: company.employeeCount,
          about: company.description,
          experiences: [],
          education: [],
          skills: company.specialties,
          certifications: [],
          languages: [],
        },
      });
    } else if (attempt < EXTRACTION_MAX_RETRIES) {
      console.log(`🔵 Nvestiv: Company extraction returned null, retrying (${attempt + 1}/${EXTRACTION_MAX_RETRIES})...`);
      setTimeout(() => handleCompanyPage(attempt + 1), EXTRACTION_RETRY_DELAY_MS);
    } else {
      console.warn('🔵 Nvestiv: Company extraction failed after retries');
    }
  } catch (error) {
    console.error('🔵 Nvestiv: Company extraction error:', error);
    if (attempt < EXTRACTION_MAX_RETRIES) {
      setTimeout(() => handleCompanyPage(attempt + 1), EXTRACTION_RETRY_DELAY_MS);
    }
  }
}

function handlePageNavigation(): void {
  const pageType = detectPageType(window.location.href);
  console.log('🔵 Nvestiv: Page type detected:', pageType, window.location.href);

  sendMessage({
    type: 'PAGE_CHANGED',
    data: { pageType, url: window.location.href },
  });

  if (pageType === 'profile') {
    // Wait for DOM to settle after SPA navigation
    setTimeout(() => handleProfilePage(0), 1000);
  } else if (pageType === 'company') {
    setTimeout(() => handleCompanyPage(0), 1000);
  }
}

// ============================================================
// SPA Navigation Detection
// ============================================================

let lastUrl = window.location.href;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;

    // Debounce re-extraction to avoid partial data during SPA transitions
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handlePageNavigation();
    }, ENTITY_CHECK_DEBOUNCE_MS);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// ============================================================
// Initial Page Load
// ============================================================

handlePageNavigation();
