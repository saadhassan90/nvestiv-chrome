# Nvestiv Chrome Extension - Technical Implementation Guide

**Version:** 1.0  
**Date:** February 11, 2025  
**Audience:** Development Team (Anti-Gravity / Claude Code)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Database Strategy](#database-strategy)
4. [Technology Stack](#technology-stack)
5. [Chrome Extension Structure](#chrome-extension-structure)
6. [Backend API Specification](#backend-api-specification)
7. [Report Generation Pipeline](#report-generation-pipeline)
8. [Data Models](#data-models)
9. [Authentication & Security](#authentication--security)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Development Workflow](#development-workflow)
12. [Testing Requirements](#testing-requirements)

---

## Overview

This document provides technical implementation details for the Nvestiv Chrome Extension. Read this in conjunction with the **Chrome Extension Product Specification** document.

### What We're Building

1. **Chrome Extension** (Manifest V3)
   - Side panel UI for LinkedIn profile intelligence
   - Content script for data extraction
   - Background service worker for API communication

2. **Standalone Intelligence API** (Separate from main Nvestiv app)
   - Report generation service
   - Intelligence database
   - RESTful endpoints for extension

3. **Report Page Application** (Next.js/React)
   - Hosted at `reports.nvestiv.com`
   - Renders intelligence reports
   - PDF export functionality

### Key Architecture Principle

**Separation of Concerns:**
- Intelligence data lives in a **separate database** from the main Nvestiv app
- Intelligence API is a **standalone microservice**
- Main app CRM can query intelligence API but doesn't store raw intelligence data
- This keeps the CRM database clean and focused on operational data

### Integration with Existing Nvestiv App

**CRM Schema Integration:**
- The Nvestiv CRM app already has an existing database schema for contacts and related data
- A **separate CRM schema file** will be provided that documents the existing contact structure
- Developers will create **mapping logic** to transform intelligence report data into CRM-compatible format
- The mapping ensures that enriched data from reports flows correctly into existing CRM contact records

**Authentication Strategy:**
- Users authenticate using their **existing Nvestiv app credentials** (single sign-on)
- Even though the intelligence database is separate, authentication goes through the main Nvestiv app
- The Intelligence API validates tokens issued by the main Nvestiv authentication service
- No separate user accounts or login system for the intelligence platform
- Session management and user permissions inherit from main app

**Data Flow:**
```
User Login → Nvestiv App Auth → JWT Token → Chrome Extension + Intelligence API
                                           ↓
                            Intelligence DB (separate) + CRM DB (main app)
                                           ↓
                        Report Data → Mapping Layer → CRM Contact Record
```

---

## CRM Integration & Data Mapping

### Overview

The Intelligence API generates rich, structured reports but must integrate with the existing Nvestiv CRM schema. A separate **CRM Schema Documentation** file will be provided that details:
- Contact table structure
- Custom fields and their data types
- Relationship tables (companies, funds, investments)
- Validation rules and constraints

### Mapping Strategy

**Two-Way Integration:**

1. **Intelligence → CRM** (Enrichment)
   - User clicks "Send to CRM" in report page
   - Report's structured_data is transformed to match CRM schema
   - API calls main Nvestiv app's enrichment endpoint
   - CRM merges incoming data with existing contact record

2. **CRM → Intelligence** (Context)
   - When generating reports, query CRM for existing context
   - Include deal involvement, meeting history, tags in report generation
   - Provides more personalized intelligence

### Data Mapping Layer

**Location:** `intelligence-api/src/services/crmMapper.ts`

```typescript
import { Report } from '../types';
import { CRMContactSchema } from './schemas/crmSchema'; // From provided schema file

export class CRMMapper {
  /**
   * Transform intelligence report structured data to CRM contact format
   * Maps report fields to existing CRM schema
   */
  mapReportToCRM(report: Report): CRMContactSchema {
    return {
      // Basic Contact Info
      full_name: report.subject.full_name,
      email: report.subject.email,
      phone: report.subject.phone,
      linkedin_url: report.subject.linkedin_url,
      location: report.subject.location,
      
      // Professional Info (map to CRM's professional fields)
      current_title: report.subject.current_title,
      current_company: report.subject.current_company,
      
      // Experience (map to CRM's experience/history structure)
      professional_background: this.mapExperience(report),
      
      // Investment Profile (map to CRM's investment tracking fields)
      entity_type: report.subject.entity_type,
      investment_focus: this.extractInvestmentFocus(report),
      check_size_range: this.extractCheckSize(report),
      stage_focus: this.extractStageFocus(report),
      
      // Intelligence Metadata (CRM fields for tracking intelligence)
      intelligence_report_id: report.report_id,
      intelligence_report_url: `https://reports.nvestiv.com/r/${report.report_id}`,
      last_intelligence_update: report.generated_at,
      intelligence_quality_score: report.metadata.quality_score,
      
      // Custom CRM fields (based on provided schema)
      // ... additional mappings based on CRM schema file
    };
  }
  
  /**
   * Extract investment focus from report sections
   */
  private extractInvestmentFocus(report: Report): string[] {
    const investmentSection = report.sections.find(s => s.section_id === 'sec_003');
    if (!investmentSection) return [];
    
    // Parse structured_data from investment activity section
    const subsection = investmentSection.subsections[0];
    return subsection.structured_data?.investment_summary?.sector_breakdown 
      ? Object.keys(subsection.structured_data.investment_summary.sector_breakdown)
      : [];
  }
  
  /**
   * Map experience to CRM's career history format
   */
  private mapExperience(report: Report): any[] {
    const backgroundSection = report.sections.find(s => s.section_id === 'sec_001');
    const careerSubsection = backgroundSection?.subsections.find(
      s => s.subsection_id === 'subsec_001_001'
    );
    
    return careerSubsection?.structured_data?.career_history || [];
  }
  
  // ... additional mapping methods
}
```

### Enrichment API Endpoint

**POST to Main Nvestiv App:**

```typescript
// intelligence-api/src/services/crmEnrichment.ts
import axios from 'axios';
import { CRMMapper } from './crmMapper';

export async function enrichCRMContact(report: Report, contactId?: string) {
  const mapper = new CRMMapper();
  const crmData = mapper.mapReportToCRM(report);
  
  // Call main Nvestiv app's enrichment endpoint
  const response = await axios.post(
    `${process.env.MAIN_APP_URL}/api/crm/contacts/enrich`,
    {
      contact_id: contactId, // If updating existing
      source: 'intelligence_report',
      report_id: report.report_id,
      data: crmData
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_TO_SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}
```

### Field Mapping Reference

**To be completed once CRM schema file is provided:**

| Report Field | CRM Field | Transformation | Notes |
|-------------|-----------|----------------|-------|
| `subject.full_name` | `contacts.full_name` | Direct | - |
| `subject.email` | `contacts.email` | Direct | Validate format |
| `subject.current_company` | `contacts.company_id` | Lookup/Create | May need company resolution |
| `abstract.key_findings[]` | `contacts.notes` | Array → Text | Join with newlines |
| `sections[sec_003].structured_data.investment_summary` | `contacts.investment_profile` | JSON | Store as JSONB |
| ... | ... | ... | ... |

**Note:** Complete mapping table will be created after reviewing CRM schema documentation.

### Merge Strategy

When enriching an existing CRM contact:

1. **Non-destructive by default:** Don't overwrite user-entered data
2. **Confidence-based:** Only update if intelligence data has higher confidence
3. **Additive for arrays:** Append to lists (investments, news mentions)
4. **Timestamp tracking:** Record when each field was last enriched
5. **Conflict resolution:** Flag conflicts for user review

```typescript
interface EnrichmentStrategy {
  mode: 'overwrite' | 'append' | 'skip_if_exists';
  confidence_threshold?: number;
}

const FIELD_STRATEGIES: Record<string, EnrichmentStrategy> = {
  'email': { mode: 'skip_if_exists' }, // Never overwrite user-entered email
  'phone': { mode: 'skip_if_exists' },
  'investment_focus': { mode: 'append' }, // Add new sectors
  'recent_news': { mode: 'append' }, // Add new news items
  'bio': { mode: 'overwrite', confidence_threshold: 0.9 } // Update if highly confident
};
```

---

## Architecture Decisions

### Decision 1: Separate Intelligence Database

**Rationale:**
- Intelligence data is high-volume, append-only (reports rarely deleted)
- Main CRM database focuses on operational data (contacts, deals, tasks)
- Allows independent scaling of intelligence workloads
- Clear separation between "source of truth" intelligence vs. user's CRM data
- Easier to implement multi-tenancy and data sharing

**Implementation:**
```
┌─────────────────────────────────────────────────────┐
│  CHROME EXTENSION                                    │
│  - Content Script                                    │
│  - Background Worker                                 │
│  - Side Panel UI                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTPS / REST API
                   ▼
┌─────────────────────────────────────────────────────┐
│  INTELLIGENCE API (Standalone Service)               │
│  - Express.js / Fastify                              │
│  - Report Generation                                 │
│  - Entity Management                                 │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────┐      ┌──────────────────┐
│  STRUCTURED  │      │  VECTOR DATABASE │
│  DATABASE    │      │  (Supabase       │
│  (Supabase   │      │   pgvector)      │
│   Postgres)  │      │                  │
└──────────────┘      └──────────────────┘
       │
       │ Read-only API calls
       ▼
┌─────────────────────────────────────────────────────┐
│  MAIN NVESTIV APP                                    │
│  - CRM Database (contacts, deals, tasks)            │
│  - Can query intelligence API for enrichment         │
│  - Stores references to reports (URLs/IDs only)      │
└─────────────────────────────────────────────────────┘
```

### Decision 2: Dual Storage Strategy

**Store ALL intelligence data in TWO formats:**

1. **Structured Tables (PostgreSQL via Supabase)**
   - Relational data model
   - Fast queries for exact matches
   - Transaction support
   - Foreign key relationships

2. **Vector Embeddings (pgvector in Supabase)**
   - Semantic search capabilities
   - RAG (Retrieval Augmented Generation)
   - Similar entity discovery
   - Content-based recommendations

**Why Supabase:**
- Single database platform (Postgres + pgvector extension)
- No need for separate Quadrant instance
- Simpler infrastructure
- Built-in auth, real-time, and APIs
- Cost-effective for our scale

### Decision 3: Report Generation as Async Job

**Pattern:** Job Queue + Worker Pool

```
User Request → API Endpoint → Job Queue (BullMQ/Redis)
                                    ↓
                            Worker Pool (Gemini API calls)
                                    ↓
                            Store Results → Notify User
```

**Rationale:**
- Reports take 2-3 minutes to generate
- Don't block HTTP request
- Can scale workers independently
- Retry failed jobs
- Progress tracking

---

## Database Strategy

### Supabase Setup

**Single Supabase Project:**
- Production database
- PostgreSQL 15+
- pgvector extension enabled
- Row Level Security (RLS) for multi-tenancy

### Schema Design

#### Structured Tables

```sql
-- Organizations (multi-tenancy)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::JSONB
);

-- Entities (people, companies, funds)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'company', 'fund')),
  
  -- Identifiers
  linkedin_url TEXT UNIQUE,
  canonical_name TEXT NOT NULL,
  
  -- Master Profile (synthesized from all reports)
  canonical_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Intelligence Summary
  total_reports INT DEFAULT 0,
  last_updated TIMESTAMPTZ,
  
  -- Confidence Scores
  data_confidence JSONB DEFAULT '{}'::JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on linkedin_url for fast lookups
CREATE INDEX idx_entities_linkedin ON entities(linkedin_url);
CREATE INDEX idx_entities_type ON entities(entity_type);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  
  -- Ownership
  generated_by_org UUID REFERENCES organizations(id),
  generated_by_user UUID, -- Reference to main app user
  
  -- Timing
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Visibility
  visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('private', 'shared', 'public')),
  
  -- Full Report JSON (complete schema from product spec)
  report_content JSONB NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Usage Stats
  view_count INT DEFAULT 0,
  crm_enrichment_count INT DEFAULT 0,
  pdf_download_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_entity ON reports(entity_id);
CREATE INDEX idx_reports_org ON reports(generated_by_org);
CREATE INDEX idx_reports_visibility ON reports(visibility);

-- Entity Versions (change tracking)
CREATE TABLE entity_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  report_id UUID REFERENCES reports(id),
  
  changes JSONB DEFAULT '[]'::JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(entity_id, version_number)
);

-- Report Generation Jobs (for tracking async tasks)
CREATE TABLE report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  entity_id UUID REFERENCES entities(id),
  requested_by_org UUID REFERENCES organizations(id),
  requested_by_user UUID,
  
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  error_message TEXT,
  
  -- Result
  report_id UUID REFERENCES reports(id),
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status ON report_jobs(status);
CREATE INDEX idx_jobs_entity ON report_jobs(entity_id);
```

#### Vector Storage Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Entity Embeddings (for semantic search on entities)
CREATE TABLE entity_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  
  -- Text that was embedded
  source_text TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'profile_summary', 'bio', 'investment_focus'
  
  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding vector(1536) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(entity_id, source_type)
);

-- Create HNSW index for fast similarity search
CREATE INDEX idx_entity_embeddings_vector 
ON entity_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Report Section Embeddings (for RAG on report content)
CREATE TABLE report_section_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  
  section_id TEXT NOT NULL, -- 'sec_001', 'subsec_001_001'
  section_title TEXT NOT NULL,
  section_content TEXT NOT NULL,
  
  embedding vector(1536) NOT NULL,
  
  metadata JSONB DEFAULT '{}'::JSONB, -- Store section metadata
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_sections_vector 
ON report_section_embeddings 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_report_sections_report ON report_section_embeddings(report_id);

-- Citation Embeddings (for source verification)
CREATE TABLE citation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  
  citation_id INT NOT NULL,
  citation_text TEXT NOT NULL,
  source_url TEXT,
  
  embedding vector(1536) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citation_embeddings_vector 
ON citation_embeddings 
USING hnsw (embedding vector_cosine_ops);
```

### Data Flow: Dual Storage

**When a report is generated:**

```javascript
// 1. Store structured data
const report = await supabase
  .from('reports')
  .insert({
    entity_id: entityId,
    report_content: fullReportJSON,
    generated_by_org: orgId,
    visibility: 'shared'
  })
  .select()
  .single();

// 2. Generate and store embeddings
const embeddings = await generateEmbeddings(fullReportJSON);

// 2a. Entity-level embedding (profile summary)
await supabase
  .from('entity_embeddings')
  .upsert({
    entity_id: entityId,
    source_text: fullReportJSON.abstract.summary,
    source_type: 'profile_summary',
    embedding: embeddings.profileEmbedding
  });

// 2b. Section-level embeddings (for RAG)
for (const section of fullReportJSON.sections) {
  for (const subsection of section.subsections) {
    await supabase
      .from('report_section_embeddings')
      .insert({
        report_id: report.id,
        section_id: subsection.subsection_id,
        section_title: subsection.title,
        section_content: subsection.content,
        embedding: await embed(subsection.content),
        metadata: { section_number: section.section_number }
      });
  }
}

// 2c. Citation embeddings (for source verification)
const allCitations = extractAllCitations(fullReportJSON);
for (const citation of allCitations) {
  await supabase
    .from('citation_embeddings')
    .insert({
      report_id: report.id,
      citation_id: citation.id,
      citation_text: citation.text,
      source_url: citation.source_url,
      embedding: await embed(citation.text)
    });
}
```

### Vector Search Functions

**Semantic Entity Search:**

```sql
-- Function to find similar entities
CREATE OR REPLACE FUNCTION search_similar_entities(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_type text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT 
    e.id as entity_id,
    e.canonical_name as entity_name,
    e.entity_type,
    1 - (ee.embedding <=> query_embedding) as similarity
  FROM entity_embeddings ee
  JOIN entities e ON ee.entity_id = e.id
  WHERE 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**RAG on Report Content:**

```sql
-- Function to retrieve relevant report sections for RAG
CREATE OR REPLACE FUNCTION retrieve_report_sections(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  report_id uuid,
  section_id text,
  section_title text,
  section_content text,
  similarity float,
  metadata jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    rse.report_id,
    rse.section_id,
    rse.section_title,
    rse.section_content,
    1 - (rse.embedding <=> query_embedding) as similarity,
    rse.metadata
  FROM report_section_embeddings rse
  WHERE 1 - (rse.embedding <=> query_embedding) > match_threshold
  ORDER BY rse.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Technology Stack

### Chrome Extension

```json
{
  "manifest_version": 3,
  "name": "Nvestiv Intelligence",
  "version": "1.0.0",
  
  "framework": "React 18",
  "bundler": "Vite",
  "language": "TypeScript",
  "styling": "TailwindCSS",
  
  "libraries": [
    "chrome-types",
    "axios (API calls)",
    "zustand (state management)"
  ]
}
```

**Project Structure:**
```
chrome-extension/
├── manifest.json
├── src/
│   ├── content/           # Content script (runs on LinkedIn)
│   │   ├── index.tsx
│   │   └── extractors/
│   │       ├── linkedinProfile.ts
│   │       └── linkedinCompany.ts
│   ├── background/        # Service worker
│   │   ├── index.ts
│   │   └── api.ts
│   ├── sidepanel/         # Side panel UI
│   │   ├── index.tsx
│   │   ├── components/
│   │   └── store/
│   ├── shared/
│   │   ├── types.ts
│   │   └── constants.ts
│   └── assets/
├── public/
│   └── icons/
└── package.json
```

### Intelligence API Backend

```json
{
  "runtime": "Node.js 20+",
  "framework": "Fastify (or Express.js)",
  "language": "TypeScript",
  
  "core_dependencies": [
    "@supabase/supabase-js (database client)",
    "bullmq (job queue)",
    "ioredis (Redis client)",
    "@google/generative-ai (Gemini SDK)",
    "openai (for embeddings)",
    "zod (schema validation)",
    "winston (logging)"
  ],
  
  "infrastructure": [
    "Railway / Fly.io / Render (hosting)",
    "Upstash Redis (job queue)",
    "Supabase (database + auth)"
  ]
}
```

**Project Structure:**
```
intelligence-api/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── intelligence.ts
│   │   ├── entities.ts
│   │   └── reports.ts
│   ├── services/
│   │   ├── reportGenerator.ts
│   │   ├── geminiService.ts
│   │   ├── embeddingService.ts
│   │   └── entityManager.ts
│   ├── workers/
│   │   └── reportWorker.ts
│   ├── db/
│   │   ├── supabase.ts
│   │   └── queries/
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── logger.ts
│       └── validators.ts
├── package.json
└── tsconfig.json
```

### Report Page Application

```json
{
  "framework": "Next.js 14 (App Router)",
  "language": "TypeScript",
  "styling": "TailwindCSS",
  
  "libraries": [
    "react-pdf (PDF export)",
    "marked (Markdown parsing)",
    "@supabase/ssr (auth + data)",
    "recharts (visualizations)"
  ],
  
  "hosting": "Vercel (reports.nvestiv.com)"
}
```

**Project Structure:**
```
report-page/
├── app/
│   ├── r/
│   │   └── [reportId]/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ReportHeader.tsx
│   ├── ReportSection.tsx
│   ├── Citation.tsx
│   └── Bibliography.tsx
├── lib/
│   ├── supabase.ts
│   └── pdfExport.ts
└── package.json
```

---

## Chrome Extension Structure

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Nvestiv Intelligence",
  "version": "1.0.0",
  "description": "AI-powered intelligence for alternative investment professionals",
  
  "permissions": [
    "storage",
    "sidePanel",
    "tabs",
    "notifications"
  ],
  
  "host_permissions": [
    "https://*.linkedin.com/*",
    "https://api.nvestiv.com/*",
    "https://reports.nvestiv.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["https://*.linkedin.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  
  "action": {
    "default_title": "Nvestiv Intelligence"
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Content Script Responsibilities

**File:** `src/content/index.tsx`

```typescript
// Main content script that runs on LinkedIn
import { extractLinkedInProfile } from './extractors/linkedinProfile';
import { detectPageType } from './utils/pageDetection';

// Detect what type of LinkedIn page we're on
const pageType = detectPageType(window.location.href);

if (pageType === 'profile') {
  // Extract profile data from DOM
  const profileData = extractLinkedInProfile();
  
  // Send to background worker
  chrome.runtime.sendMessage({
    type: 'PROFILE_DETECTED',
    data: profileData
  });
}

// Listen for page navigation (SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;
    // Re-detect and extract
    handlePageChange();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

**LinkedIn Profile Extractor:**

```typescript
// src/content/extractors/linkedinProfile.ts
export interface LinkedInProfile {
  fullName: string;
  headline: string;
  location: string;
  profileUrl: string;
  photoUrl: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  connectionCount: string | null;
}

export function extractLinkedInProfile(): LinkedInProfile | null {
  try {
    // LinkedIn's DOM structure (subject to change)
    const nameElement = document.querySelector('h1.text-heading-xlarge');
    const headlineElement = document.querySelector('.text-body-medium.break-words');
    const locationElement = document.querySelector('.text-body-small.inline.t-black--light');
    
    // ... extract all fields
    
    return {
      fullName: nameElement?.textContent?.trim() || '',
      headline: headlineElement?.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      profileUrl: window.location.href,
      photoUrl: extractProfilePhoto(),
      currentCompany: extractCurrentCompany(),
      currentTitle: extractCurrentTitle(),
      connectionCount: extractConnectionCount()
    };
  } catch (error) {
    console.error('Failed to extract LinkedIn profile:', error);
    return null;
  }
}
```

### Background Service Worker

**File:** `src/background/index.ts`

```typescript
import { checkEntityExists, generateReport, getReportStatus } from './api';

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROFILE_DETECTED') {
    handleProfileDetected(message.data);
  }
  return true; // Keep channel open for async response
});

async function handleProfileDetected(profileData: LinkedInProfile) {
  // Check if entity exists in our database
  const entityCheck = await checkEntityExists(profileData.profileUrl);
  
  // Update side panel with results
  chrome.runtime.sendMessage({
    type: 'ENTITY_STATUS_UPDATE',
    data: {
      profile: profileData,
      exists: entityCheck.exists,
      hasReport: entityCheck.hasReport,
      reportAge: entityCheck.reportAge
    }
  });
}

// API communication
async function checkEntityExists(linkedinUrl: string) {
  const response = await fetch(
    `${API_BASE}/api/intelligence/exists?entity=${encodeURIComponent(linkedinUrl)}`,
    {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      }
    }
  );
  return response.json();
}
```

### Side Panel UI

**File:** `src/sidepanel/index.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useStore } from './store';

export default function SidePanel() {
  const { profile, entityStatus, isAuthenticated } = useStore();
  
  useEffect(() => {
    // Listen for updates from background worker
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'ENTITY_STATUS_UPDATE') {
        useStore.setState({ 
          profile: message.data.profile,
          entityStatus: message.data
        });
      }
    });
  }, []);
  
  if (!isAuthenticated) {
    return <AuthScreen />;
  }
  
  if (!profile) {
    return <EmptyState />;
  }
  
  if (entityStatus?.hasReport) {
    return <ExistingContactView />;
  }
  
  return <NewContactView />;
}
```

---

## Backend API Specification

### Base URL
```
Production: https://api.nvestiv.com/intelligence
Development: http://localhost:3000/api/intelligence
```

### Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer {token}
```

Token obtained from main Nvestiv app OAuth flow.

### Endpoints

#### 1. Check Entity Exists

```http
GET /api/intelligence/exists?entity={linkedin_url}
```

**Query Parameters:**
- `entity` (required): URL-encoded LinkedIn profile URL

**Response:**
```json
{
  "exists": true,
  "entity_id": "ent_abc123",
  "has_report": true,
  "latest_report": {
    "report_id": "rpt_xyz789",
    "generated_at": "2025-01-28T14:32:00Z",
    "age_days": 14,
    "version": 6
  },
  "canonical_data": {
    "full_name": "John Smith",
    "current_title": "Partner",
    "current_company": "Sequoia Capital"
  }
}
```

#### 2. Generate Report

```http
POST /api/intelligence/generate
```

**Request Body:**
```json
{
  "entity": {
    "linkedin_url": "https://linkedin.com/in/johnsmith",
    "entity_type": "person",
    "extracted_data": {
      "full_name": "John Smith",
      "headline": "Partner at Sequoia Capital",
      "location": "San Francisco, CA"
    }
  },
  "options": {
    "priority": "normal",
    "notify_when_complete": true
  }
}
```

**Response:**
```json
{
  "job_id": "job_abc123",
  "entity_id": "ent_xyz789",
  "status": "queued",
  "estimated_time_seconds": 180
}
```

#### 3. Get Job Status

```http
GET /api/intelligence/status/{job_id}
```

**Response:**
```json
{
  "job_id": "job_abc123",
  "status": "processing",
  "progress": 65,
  "current_step": "Analyzing recent investments",
  "completed_steps": ["LinkedIn extraction", "News search", "Firm research"],
  "remaining_steps": ["Network analysis"],
  "started_at": "2025-02-11T14:30:00Z",
  "estimated_completion": "2025-02-11T14:33:00Z"
}
```

When complete:
```json
{
  "job_id": "job_abc123",
  "status": "completed",
  "progress": 100,
  "report_id": "rpt_final123",
  "report_url": "https://reports.nvestiv.com/r/rpt_final123",
  "completed_at": "2025-02-11T14:32:47Z"
}
```

#### 4. Get Report

```http
GET /api/intelligence/report/{report_id}
```

**Response:**
```json
{
  "report_id": "rpt_xyz789",
  "entity_id": "ent_abc123",
  "version": 7,
  "generated_at": "2025-02-11T14:32:00Z",
  "generated_by_org": "org_family_office",
  
  "subject": { /* ... */ },
  "abstract": { /* ... */ },
  "sections": [ /* ... */ ],
  "bibliography": { /* ... */ },
  "metadata": { /* ... */ }
}
```

Full schema matches product specification document.

#### 5. Refresh Report

```http
POST /api/intelligence/refresh/{report_id}
```

**Request Body:**
```json
{
  "force": false  // If true, regenerate even if recent
}
```

**Response:**
Same as Generate Report (returns job_id)

#### 6. Semantic Search Entities

```http
POST /api/intelligence/search/entities
```

**Request Body:**
```json
{
  "query": "climate tech investors focused on series B",
  "filters": {
    "entity_type": "person",
    "has_report": true
  },
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "entity_id": "ent_abc123",
      "entity_name": "John Smith",
      "entity_type": "person",
      "similarity_score": 0.92,
      "latest_report_id": "rpt_xyz789",
      "snippet": "Active in climate tech with 15 investments..."
    }
  ],
  "total_results": 47
}
```

#### 7. RAG Query

```http
POST /api/intelligence/rag/query
```

**Request Body:**
```json
{
  "query": "What are John Smith's recent climate tech investments?",
  "context": {
    "entity_id": "ent_abc123"  // Optional: scope to specific entity
  },
  "max_sections": 5
}
```

**Response:**
```json
{
  "answer": "Based on the intelligence reports, John Smith has made 15 climate tech investments in the last 24 months, with notable deals including...",
  "sources": [
    {
      "report_id": "rpt_xyz789",
      "section_id": "subsec_003_001",
      "section_title": "Recent Investment Activity",
      "similarity_score": 0.89,
      "citation_ids": [17, 18, 19]
    }
  ]
}
```

---

## Report Generation Pipeline

### Overview

```
1. User Request
   ↓
2. Create Job in Database
   ↓
3. Add to BullMQ Queue
   ↓
4. Worker Picks Up Job
   ↓
5. Gemini Deep Research
   ↓
6. Structure Data
   ↓
7. Generate Embeddings
   ↓
8. Store Dual Format (Structured + Vector)
   ↓
9. Update Entity Master Profile
   ↓
10. Mark Job Complete
```

### Worker Implementation

**File:** `src/workers/reportWorker.ts`

```typescript
import { Worker } from 'bullmq';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { supabase } from '../db/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface ReportJob {
  entity_id: string;
  linkedin_url: string;
  extracted_data: any;
  job_id: string;
}

const worker = new Worker('report-generation', async (job) => {
  const { entity_id, linkedin_url, extracted_data, job_id } = job.data as ReportJob;
  
  try {
    // Update job status
    await updateJobStatus(job_id, 'processing', 10, 'Starting deep research');
    
    // Step 1: Generate report with Gemini
    await updateJobStatus(job_id, 'processing', 20, 'Running Gemini Deep Research');
    const geminiReport = await generateWithGemini(linkedin_url, extracted_data);
    
    // Step 2: Structure the report
    await updateJobStatus(job_id, 'processing', 50, 'Structuring report data');
    const structuredReport = await structureReport(geminiReport);
    
    // Step 3: Store structured data
    await updateJobStatus(job_id, 'processing', 70, 'Storing report data');
    const { data: report } = await supabase
      .from('reports')
      .insert({
        entity_id,
        report_content: structuredReport,
        generated_by_org: job.data.org_id,
        visibility: 'shared',
        metadata: {
          generation_time: Date.now() - job.timestamp,
          gemini_model: 'gemini-2.0-flash-thinking-exp-01-21'
        }
      })
      .select()
      .single();
    
    // Step 4: Generate and store embeddings
    await updateJobStatus(job_id, 'processing', 80, 'Generating embeddings');
    await generateAndStoreEmbeddings(report.id, entity_id, structuredReport);
    
    // Step 5: Update entity master profile
    await updateJobStatus(job_id, 'processing', 90, 'Updating entity profile');
    await updateEntityMasterProfile(entity_id, structuredReport);
    
    // Step 6: Mark complete
    await updateJobStatus(job_id, 'completed', 100, 'Report generated successfully', report.id);
    
    return { report_id: report.id };
    
  } catch (error) {
    await updateJobStatus(job_id, 'failed', 0, error.message);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  concurrency: 5 // Process 5 reports concurrently
});

async function generateWithGemini(linkedinUrl: string, extractedData: any) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp-01-21' });
  
  const prompt = `
Generate a comprehensive intelligence report following this exact JSON schema:

[Full schema from product spec]

Research all public sources for: ${extractedData.full_name} at ${extractedData.current_company}
LinkedIn: ${linkedinUrl}

Focus areas:
- Professional background
- Current firm analysis
- Investment activity (last 24 months)
- Recent news and media presence
- Network and relationships
- Strategic relevance for LPs

Return ONLY valid JSON matching the schema.
  `;
  
  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Parse and validate JSON
  return JSON.parse(response);
}

async function generateAndStoreEmbeddings(reportId: string, entityId: string, report: any) {
  // Entity-level embedding
  const profileEmbedding = await embed(report.abstract.summary);
  await supabase.from('entity_embeddings').upsert({
    entity_id: entityId,
    source_text: report.abstract.summary,
    source_type: 'profile_summary',
    embedding: profileEmbedding
  });
  
  // Section-level embeddings
  for (const section of report.sections) {
    for (const subsection of section.subsections) {
      const sectionEmbedding = await embed(subsection.content);
      await supabase.from('report_section_embeddings').insert({
        report_id: reportId,
        section_id: subsection.subsection_id,
        section_title: subsection.title,
        section_content: subsection.content,
        embedding: sectionEmbedding,
        metadata: { section_number: section.section_number }
      });
    }
  }
}

async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536
  });
  return response.data[0].embedding;
}
```

### Gemini Prompt Engineering

**Prompt Template:**

```typescript
const REPORT_GENERATION_PROMPT = `
You are a research analyst specializing in alternative investments. Generate a comprehensive intelligence report on the following individual.

SUBJECT INFORMATION:
Name: {full_name}
Current Role: {current_title} at {current_company}
LinkedIn: {linkedin_url}
Location: {location}

RESEARCH REQUIREMENTS:
1. Search all public sources: LinkedIn, company websites, news articles, PitchBook, Crunchbase, SEC filings
2. For every claim, provide inline citations with [number] format
3. Structure data in both narrative (content field) and structured (structured_data field) formats
4. Include full bibliography with all sources
5. Provide confidence scores for each section
6. Extract actionable intelligence for investment decision-making

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema:

${JSON_SCHEMA}

CRITICAL REQUIREMENTS:
- Every factual claim must have a citation [1], [2], etc.
- Citations must include source_url, source_title, accessed_date
- Structured_data must be complete and queryable
- Content must be professional, third-person, analytical
- Focus on investment-relevant intelligence

Begin research and return JSON:
`;
```

---

## Data Models

### TypeScript Types

**File:** `src/types/index.ts`

```typescript
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
}

export interface Abstract {
  summary: string;
  key_findings: string[];
  relevance_score: number;
  relevance_notes: string;
}

export interface Section {
  section_id: string;
  section_number: number;
  title: string;
  subsections: Subsection[];
}

export interface Subsection {
  subsection_id: string;
  title: string;
  content: string;  // Markdown with inline citations
  structured_data: Record<string, any>;
  citations: Citation[];
}

export interface Citation {
  id: number;
  citation_number: string;
  text: string;
  source_title: string;
  source_url: string;
  source_type: 'news' | 'database' | 'website' | 'profile' | 'sec_filing' | 'press_release';
  accessed_date: string;
  publication_date?: string;
  author?: string;
  publisher?: string;
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
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

export const CitationSchema = z.object({
  id: z.number(),
  citation_number: z.string(),
  text: z.string(),
  source_title: z.string(),
  source_url: z.string().url(),
  source_type: z.enum(['news', 'database', 'website', 'profile', 'sec_filing', 'press_release']),
  accessed_date: z.string(),
  publication_date: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional()
});

export const SubsectionSchema = z.object({
  subsection_id: z.string(),
  title: z.string(),
  content: z.string(),
  structured_data: z.record(z.any()),
  citations: z.array(CitationSchema)
});

export const SectionSchema = z.object({
  section_id: z.string(),
  section_number: z.number(),
  title: z.string(),
  subsections: z.array(SubsectionSchema)
});

export const ReportSchema = z.object({
  report_id: z.string(),
  entity_id: z.string(),
  version: z.number(),
  generated_at: z.string(),
  generated_by_org: z.string(),
  subject: z.object({
    entity_type: z.enum(['person', 'company', 'fund']),
    full_name: z.string(),
    current_title: z.string().optional(),
    current_company: z.string().optional()
    // ... rest of subject fields
  }),
  abstract: z.object({
    summary: z.string(),
    key_findings: z.array(z.string()),
    relevance_score: z.number().min(0).max(10),
    relevance_notes: z.string()
  }),
  sections: z.array(SectionSchema),
  bibliography: z.object({
    total_sources: z.number(),
    sources_by_type: z.record(z.number()),
    all_sources: z.array(CitationSchema)
  }),
  metadata: z.object({
    generation_time_seconds: z.number(),
    ai_model: z.string(),
    total_tokens: z.number(),
    sources_analyzed: z.number(),
    quality_score: z.number(),
    completeness_score: z.number(),
    confidence_scores: z.record(z.number())
  })
});

// Usage in API
app.post('/api/intelligence/report', async (req, res) => {
  const validatedReport = ReportSchema.parse(req.body);
  // ... proceed with validated data
});
```

---

## Authentication & Security

### Authentication Architecture

**Centralized Auth via Main Nvestiv App:**

The Intelligence API does NOT have its own authentication system. Instead:

1. Users log in through the **main Nvestiv app** (app.nvestiv.com)
2. Main app issues **JWT tokens** upon successful authentication
3. Chrome extension and Intelligence API validate these tokens
4. User/org data is referenced from main app's database

```
┌─────────────────────────────────────────────────┐
│  MAIN NVESTIV APP                               │
│  - User Database (PostgreSQL)                   │
│  - Authentication Service                       │
│  - JWT Token Issuer                             │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Issues JWT Token
                  ▼
┌─────────────────────────────────────────────────┐
│  CHROME EXTENSION                               │
│  - Stores token in chrome.storage               │
│  - Includes token in API requests               │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Authorization: Bearer {token}
                  ▼
┌─────────────────────────────────────────────────┐
│  INTELLIGENCE API                               │
│  - Validates JWT (verify signature)            │
│  - Extracts user_id, org_id from token         │
│  - Does NOT store user credentials             │
└─────────────────────────────────────────────────┘
```

### Extension Authentication Flow

```typescript
// Extension: src/background/auth.ts

async function authenticateExtension() {
  // 1. Open main app auth page
  const authUrl = 'https://app.nvestiv.com/auth/extension';
  const authTab = await chrome.tabs.create({ url: authUrl });
  
  // 2. Listen for auth success message from main app
  return new Promise((resolve, reject) => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'AUTH_SUCCESS') {
        // 3. Store JWT token from main app
        chrome.storage.local.set({
          auth_token: message.token,
          token_expires: message.expires_at,
          user_id: message.user_id,
          org_id: message.org_id
        });
        
        // 4. Close auth tab
        chrome.tabs.remove(authTab.id);
        
        resolve(message.token);
      }
    });
    
    setTimeout(() => reject(new Error('Auth timeout')), 60000);
  });
}

// Use token in API requests
async function makeAPIRequest(endpoint: string, options = {}) {
  const { auth_token } = await chrome.storage.local.get('auth_token');
  
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${auth_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}
```

### Main App Auth Page

**On main Nvestiv app:** `app.nvestiv.com/auth/extension`

```typescript
// Main app: pages/auth/extension.tsx
import { useSession } from 'next-auth/react';

export default function ExtensionAuthPage() {
  const { data: session } = useSession();
  
  useEffect(() => {
    if (session) {
      // User is logged in, send token to extension
      const token = await generateExtensionToken(session.user.id);
      
      // PostMessage to extension
      if (window.opener) {
        window.opener.postMessage({
          type: 'AUTH_SUCCESS',
          token: token,
          expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          user_id: session.user.id,
          org_id: session.user.organization_id
        }, '*'); // Extension will validate origin
        
        // Show success message
        showSuccess('Extension authenticated! You can close this tab.');
      }
    } else {
      // Show login form
      // After login, will trigger useEffect above
    }
  }, [session]);
  
  return (
    <div>
      {!session ? (
        <LoginForm redirect={false} />
      ) : (
        <SuccessMessage />
      )}
    </div>
  );
}
```

### JWT Token Structure

**Token issued by main Nvestiv app:**

```json
{
  "sub": "user_abc123",           // User ID
  "org_id": "org_xyz789",          // Organization ID
  "email": "user@company.com",
  "role": "user",                  // or "admin", "super_admin"
  "permissions": ["read", "write"], // Granular permissions
  "iat": 1707667200,               // Issued at
  "exp": 1710259200                // Expires (30 days later)
}
```

### Intelligence API Token Validation

```typescript
// intelligence-api/src/middleware/auth.ts
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;      // user_id
  org_id: string;
  email: string;
  role: string;
  permissions: string[];
}

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Validate token using main app's public key/secret
    // This should be the SAME secret used by main app
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    
    // Attach user info to request
    req.user_id = decoded.sub;
    req.org_id = decoded.org_id;
    req.email = decoded.email;
    req.role = decoded.role;
    req.permissions = decoded.permissions;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;
```

### Service-to-Service Authentication

When Intelligence API needs to call main Nvestiv app (e.g., for CRM enrichment):

```typescript
// intelligence-api/src/services/serviceAuth.ts

// Use a long-lived service token
const SERVICE_TOKEN = process.env.SERVICE_TO_SERVICE_TOKEN;

async function callMainAppAPI(endpoint: string, data: any) {
  return fetch(`${process.env.MAIN_APP_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`,
      'X-Service-Name': 'intelligence-api',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}
```

### User Data Resolution

Intelligence API **does not store** user credentials or profiles. When needed:

```typescript
// Option 1: Get user info from JWT token (already decoded)
const userId = req.user_id;
const orgId = req.org_id;

// Option 2: If more user data needed, query main app
async function getUserProfile(userId: string) {
  const response = await fetch(
    `${process.env.MAIN_APP_URL}/api/internal/users/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`
      }
    }
  );
  return response.json();
}
```

### Row Level Security (RLS) in Supabase

```sql
-- Enable RLS on all tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own org's private reports
CREATE POLICY "Users see own org private reports"
ON reports FOR SELECT
USING (
  visibility = 'public' 
  OR visibility = 'shared'
  OR (visibility = 'private' AND generated_by_org = auth.jwt() ->> 'org_id')
);

-- Policy: Users can only create reports for their org
CREATE POLICY "Users create reports for own org"
ON reports FOR INSERT
WITH CHECK (generated_by_org = auth.jwt() ->> 'org_id');
```

---

## Deployment & Infrastructure

### Environment Variables

```bash
# Intelligence API (.env)
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
SUPABASE_ANON_KEY=xxx

# Redis (Upstash)
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx
REDIS_TLS=true

# AI Services
GEMINI_API_KEY=xxx
OPENAI_API_KEY=xxx

# Auth
JWT_SECRET=xxx
JWT_EXPIRES_IN=30d

# Monitoring
SENTRY_DSN=xxx
LOG_LEVEL=info
```

### Docker Setup

**Dockerfile:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**docker-compose.yml (for local development):**

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  worker:
    build: .
    command: node dist/workers/reportWorker.js
    environment:
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_HOST=redis
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
```

### Deployment Platforms

**Intelligence API:**
- **Recommended:** Railway.app or Fly.io
- Auto-scaling based on load
- Built-in Redis (or use Upstash)
- Simple GitHub deployment

**Report Page:**
- **Recommended:** Vercel
- Next.js optimized
- Edge functions for API routes
- Automatic SSL

**Chrome Extension:**
- Chrome Web Store
- Manual review process (plan for 3-5 day review)

---

## Development Workflow

### Local Development Setup

```bash
# 1. Clone repositories
git clone https://github.com/nvestiv/chrome-extension
git clone https://github.com/nvestiv/intelligence-api
git clone https://github.com/nvestiv/report-page

# 2. Install dependencies
cd chrome-extension && npm install
cd ../intelligence-api && npm install
cd ../report-page && npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Start Supabase (if using local)
npx supabase start

# 5. Run migrations
npx supabase db push

# 6. Start services
# Terminal 1: API
cd intelligence-api && npm run dev

# Terminal 2: Worker
cd intelligence-api && npm run worker

# Terminal 3: Report Page
cd report-page && npm run dev

# Terminal 4: Chrome Extension
cd chrome-extension && npm run dev
# Then load unpacked extension in Chrome
```

### Git Workflow

```
main
  ├── develop
  │   ├── feature/linkedin-extraction
  │   ├── feature/report-generation
  │   └── feature/vector-search
  └── release/v1.0.0
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

---

## Testing Requirements

### Unit Tests

```typescript
// Example: Test LinkedIn extraction
import { extractLinkedInProfile } from './extractors/linkedinProfile';

describe('LinkedIn Profile Extraction', () => {
  it('should extract profile data from DOM', () => {
    // Setup mock DOM
    document.body.innerHTML = `
      <h1 class="text-heading-xlarge">John Smith</h1>
      <div class="text-body-medium">Partner at Sequoia Capital</div>
    `;
    
    const result = extractLinkedInProfile();
    
    expect(result.fullName).toBe('John Smith');
    expect(result.headline).toBe('Partner at Sequoia Capital');
  });
});
```

### Integration Tests

```typescript
// Test report generation pipeline
describe('Report Generation', () => {
  it('should generate and store report with embeddings', async () => {
    const jobId = await generateReport({
      linkedin_url: 'https://linkedin.com/in/test',
      entity_type: 'person'
    });
    
    // Wait for job completion
    await waitForJobComplete(jobId);
    
    // Verify structured data stored
    const report = await getReport(jobId.report_id);
    expect(report.sections).toHaveLength(6);
    
    // Verify embeddings stored
    const embeddings = await getEntityEmbeddings(report.entity_id);
    expect(embeddings).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('Generate report from LinkedIn profile', async ({ page, context }) => {
  // Install extension
  const extensionPath = './dist';
  const userDataDir = '/tmp/test-user-data-dir';
  const browserContext = await context.newContext({
    // Load extension
  });
  
  // Navigate to LinkedIn
  await page.goto('https://linkedin.com/in/testprofile');
  
  // Wait for extension to detect profile
  await page.waitForSelector('[data-testid="nvestiv-panel"]');
  
  // Click generate report
  await page.click('[data-testid="generate-report-btn"]');
  
  // Wait for report page to open
  const reportPage = await context.waitForEvent('page');
  await reportPage.waitForSelector('[data-testid="report-content"]');
  
  // Verify report content
  expect(await reportPage.textContent('h1')).toContain('Intelligence Report');
});
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)

**Backend Setup:**
- [ ] Initialize Supabase project
- [ ] Create database schema (structured tables)
- [ ] Setup pgvector extension
- [ ] Create vector embedding tables
- [ ] Write database migration scripts
- [ ] Setup Redis (Upstash)
- [ ] Initialize Fastify/Express API
- [ ] Setup authentication middleware
- [ ] Deploy to Railway/Fly.io

**Extension Setup:**
- [ ] Initialize Chrome extension project (Vite + React + TS)
- [ ] Configure Manifest V3
- [ ] Setup build pipeline
- [ ] Create basic UI components
- [ ] Implement authentication flow

### Phase 2: LinkedIn Extraction (Week 1-2)

**Content Script:**
- [ ] Implement LinkedIn profile detection
- [ ] Write profile data extractor
- [ ] Handle SPA navigation
- [ ] Test on various profile types
- [ ] Error handling

**Side Panel:**
- [ ] Design authentication screen
- [ ] Design profile display states
- [ ] Implement data masking
- [ ] Connect to background worker
- [ ] Add loading states

### Phase 3: Report Generation (Week 2-3)

**Backend:**
- [ ] Integrate Gemini AI SDK
- [ ] Write report generation prompt
- [ ] Implement BullMQ job queue
- [ ] Create worker process
- [ ] Add job status tracking
- [ ] Implement error retry logic

**Embedding Pipeline:**
- [ ] Integrate OpenAI embeddings API
- [ ] Write embedding generation logic
- [ ] Store embeddings in pgvector
- [ ] Create similarity search functions

### Phase 4: Report Page (Week 3)

**Next.js App:**
- [ ] Setup Next.js 14 project
- [ ] Create report page route
- [ ] Implement report renderer
- [ ] Add citation links
- [ ] Style with TailwindCSS
- [ ] Implement PDF export
- [ ] Deploy to Vercel

### Phase 5: Integration & Polish (Week 4)

**Extension ↔ API:**
- [ ] Wire up all API endpoints
- [ ] Implement websocket for progress updates
- [ ] Add error handling
- [ ] Implement retry logic
- [ ] Add analytics tracking

**Testing:**
- [ ] Write unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual QA on various profiles
- [ ] Performance testing

### Phase 6: Launch Prep (Week 4)

**Chrome Web Store:**
- [ ] Create extension icons (all sizes)
- [ ] Write store listing description
- [ ] Create screenshots
- [ ] Record demo video
- [ ] Submit for review

**Documentation:**
- [ ] API documentation
- [ ] User guide
- [ ] Developer setup guide
- [ ] Troubleshooting guide

---

## Performance Considerations

### Database Optimization

```sql
-- Indexes for fast queries
CREATE INDEX CONCURRENTLY idx_reports_entity_generated 
ON reports(entity_id, generated_at DESC);

CREATE INDEX CONCURRENTLY idx_embeddings_entity 
ON entity_embeddings(entity_id);

-- Partitioning for large tables (if needed in future)
CREATE TABLE reports_2025 PARTITION OF reports
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### Caching Strategy

```typescript
// Redis cache for frequent queries
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function getReport(reportId: string) {
  // Try cache first
  const cached = await redis.get(`report:${reportId}`);
  if (cached) return JSON.parse(cached);
  
  // Fetch from database
  const report = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  
  // Cache for 1 hour
  await redis.setex(`report:${reportId}`, 3600, JSON.stringify(report));
  
  return report;
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const reportGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id
});

app.post('/api/intelligence/generate', reportGenerationLimiter, async (req, res) => {
  // ... handle report generation
});
```

---

## Monitoring & Observability

### Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Report generation started', { 
  job_id: jobId, 
  entity_id: entityId 
});
```

### Error Tracking

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});

// In error handler
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});
```

### Metrics

```typescript
// Track key metrics
const metrics = {
  reportsGenerated: new Counter('reports_generated_total'),
  reportGenerationTime: new Histogram('report_generation_seconds'),
  apiRequestDuration: new Histogram('api_request_duration_seconds')
};

// Usage
const timer = metrics.reportGenerationTime.startTimer();
await generateReport(job);
timer();
```

---

## Security Checklist

- [ ] API authentication required on all endpoints
- [ ] Row Level Security enabled in Supabase
- [ ] Rate limiting on expensive operations
- [ ] Input validation with Zod
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in report rendering
- [ ] CORS configured properly
- [ ] Secrets in environment variables (never committed)
- [ ] HTTPS only in production
- [ ] Token expiration and refresh
- [ ] Audit logging for sensitive operations

---

## Questions for Product Team

**Required Documentation:**
- [ ] **CRM Schema File** - Provide complete documentation of existing Nvestiv CRM database schema including:
  - Contact table structure and field definitions
  - Custom fields and their data types
  - Related tables (companies, funds, investments, relationships)
  - Validation rules and constraints
  - Any computed/derived fields
  - Preferred merge strategies for enrichment

**Product Decisions:**
1. **Credit System:** What's the pricing model for report generation?
2. **Rate Limits:** How many reports per user per day/month?
3. **Data Retention:** How long do we keep reports? Archive vs. delete?
4. **Privacy:** Can users request deletion of contributed reports?
5. **Quality Control:** How do we handle low-quality or spam reports?
6. **Offline Mode:** Should extension cache data for offline viewing?
7. **Multi-Language:** Do we need i18n support?
8. **Mobile:** Chrome extension only or need mobile app?

**CRM Integration:**
9. **Field Priority:** When intelligence conflicts with user-entered CRM data, which takes precedence?
10. **Enrichment Permissions:** Can all users trigger CRM enrichment or only admins?
11. **Audit Trail:** Do we need to track what fields were updated by intelligence vs. manually?
12. **Bulk Enrichment:** Should we support bulk enrichment of existing CRM contacts?

---

## Next Steps

1. **Review this document** with product and engineering teams
2. **Obtain CRM schema documentation** from main Nvestiv app team
3. **Create field mapping specification** (Intelligence Report → CRM Contact)
4. **Provision infrastructure** (Supabase, Railway, Upstash)
5. **Coordinate with main app team** on:
   - Shared JWT secret for token validation
   - Service-to-service authentication token
   - CRM enrichment API endpoint specifications
   - User/org data access patterns
6. **Setup GitHub repositories** with proper CI/CD
7. **Create project management board** (Linear/Jira)
8. **Begin Phase 1 implementation** following checklist

---

**Document Version:** 1.1  
**Last Updated:** February 11, 2025  
**Status:** Ready for Implementation

**Critical Dependencies:**
- [ ] CRM schema documentation
- [ ] Main app authentication coordination
- [ ] Service-to-service auth setup

**Contact:** [Your Development Team Lead]  
**Project Timeline:** 4-6 weeks to MVP  
**Estimated Effort:** 2-3 full-time engineers
