# Nvestiv Chrome Extension - Product Specification

**Version:** 1.0  
**Date:** February 11, 2025  
**Status:** Design Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Core Objectives](#core-objectives)
3. [Authentication Flow](#authentication-flow)
4. [Side Panel UI Specifications](#side-panel-ui-specifications)
5. [Intelligence Report Structure](#intelligence-report-structure)
6. [Report Page Design](#report-page-design)
7. [Report JSON Schema](#report-json-schema)
8. [Content Rendering Approach](#content-rendering-approach)
9. [Intelligence Database Architecture](#intelligence-database-architecture)
10. [Technical Architecture](#technical-architecture)
11. [Implementation Phases](#implementation-phases)

---

## Overview

The Nvestiv Chrome Extension transforms LinkedIn browsing into an intelligence-gathering workflow for alternative investment professionals. Similar to ZoomInfo, Apollo, or RocketReach, but purpose-built for the alternative investment space, it:

- Detects when users are viewing LinkedIn profiles
- Extracts and enriches contact data
- Generates comprehensive intelligence reports
- Builds a crowdsourced research database
- Integrates with Nvestiv CRM

**Initial Scope:** LinkedIn profiles only (people and companies)  
**Future Scope:** News articles, company pages, multi-entity detection

---

## Core Objectives

### Primary Use Cases

1. **Quick Contact Capture**
   - View LinkedIn profile
   - See available intelligence
   - Add to CRM with one click

2. **Deep Research Report**
   - Generate comprehensive dossier
   - Review structured intelligence
   - Send enriched data to CRM

3. **Intelligence Discovery**
   - Access existing reports from community
   - Avoid duplicate research costs
   - Build institutional knowledge base

### User Experience Principles

- **Minimal friction:** Works automatically, no manual data entry
- **Conversion-focused:** Show value (masked data) to encourage enrichment
- **Speed-optimized:** Instant for existing reports, fast for new research
- **Professional:** Academic-style citations, institutional-grade content

---

## Authentication Flow

### First-Time User Experience

Users must authenticate before accessing any extension features.

#### Unauthenticated State

```
┌─────────────────────────────────────┐
│  NVESTIV                             │
├─────────────────────────────────────┤
│                                      │
│  [Nvestiv Logo]                      │
│                                      │
│  Sign in to access                   │
│  intelligence reports                │
│                                      │
│  [Sign In with Nvestiv]              │
│                                      │
│  Don't have an account?              │
│  [Create Account]                    │
│                                      │
└─────────────────────────────────────┘
```

#### Authentication Process

1. User clicks "Sign In" button
2. Extension opens: `https://app.nvestiv.com/auth/extension`
3. User completes authentication on web
4. Web page sends auth token to extension via `postMessage`
5. Extension stores token in `chrome.storage.local` (encrypted)
6. Panel refreshes and shows authenticated content

#### Session Management

- Token stored securely in Chrome storage
- Token validated on every panel open
- Auto-refresh expired tokens
- "Sign Out" option available in extension menu
- Session timeout: 30 days (or configurable)

---

## Side Panel UI Specifications

### Design Pattern

Uses Chrome's native Side Panel API (like Claude in Chrome):
- Panel slides out from right side
- Pushes existing page content left
- Width: 400-450px
- Full viewport height
- Persistent across page navigation

### State 1: Existing Contact with Intelligence

When viewing a LinkedIn profile that exists in Nvestiv database:

```
┌─────────────────────────────────────┐
│  NVESTIV                      [Menu]│
├─────────────────────────────────────┤
│                                      │
│  [Profile Photo]  John Smith        │
│                   Partner            │
│                   Sequoia Capital    │
│                   📍 San Francisco   │
├─────────────────────────────────────┤
│  AVAILABLE INTELLIGENCE              │
│                                      │
│  Contact Information:                │
│  📧 j•••••@sequoia.com 🔒           │
│  📱 +1 (•••) •••-5678 🔒            │
│  🔗 LinkedIn Profile Available       │
│                                      │
│  Entity Type:                        │
│  💼 General Partner (GP)             │
│                                      │
│  Firm Details:                       │
│  • Sequoia Capital (Tracked)         │
│  • AUM: $85B+ | 24 Funds             │
│  • Focus: Early → Growth Stage       │
│                                      │
│  Investment Activity:                │
│  • 127 investments tracked           │
│  • Active in: Enterprise, Fintech    │
│  • Recent: 5 investments (Q4 2024)   │
│                                      │
│  🔒 Unlock full contact details      │
│     with enrichment                  │
├─────────────────────────────────────┤
│  INTELLIGENCE REPORTS                │
│                                      │
│  📊 Report Available                 │
│  Last researched: 14 days ago        │
│  (Jan 28, 2025)                      │
│                                      │
│  [View Full Report]                  │
│                                      │
│  or                                  │
│                                      │
│  [🔍 Generate New Report]            │
│  Research from scratch               │
│  (2-3 minutes, uses 1 credit)        │
├─────────────────────────────────────┤
│  QUICK ACTIONS                       │
│                                      │
│  [✓ Send to CRM]                     │
│   Add with available data            │
│                                      │
│  [+ Add Note]  [+ Create Task]       │
└─────────────────────────────────────┘
```

#### Data Masking Rules

**Purpose:** Show value without giving away data (conversion incentive)

- **Email:** `j•••••@sequoia.com` (first letter + domain visible)
- **Phone:** `+1 (•••) •••-5678` (country code + last 4 digits)
- **LinkedIn:** "Profile Available" (no URL until enriched)
- **Investment Details:** Count visible, specifics hidden
- **News Mentions:** Count visible, headlines hidden

**Unlock Trigger:** Click "Send to CRM" or "View Full Report"

### State 2: New Contact (Not in Database)

```
┌─────────────────────────────────────┐
│  NVESTIV                      [Menu]│
├─────────────────────────────────────┤
│                                      │
│  [Profile Photo]  John Smith        │
│                   Partner            │
│                   Sequoia Capital    │
│                   📍 San Francisco   │
├─────────────────────────────────────┤
│  ⚠ NEW CONTACT                       │
│                                      │
│  This person is not in your          │
│  Nvestiv database yet.               │
│                                      │
│  Basic LinkedIn data available:      │
│  • Current role: Partner @ Sequoia   │
│  • Location: San Francisco, CA       │
│  • 500+ connections                  │
│                                      │
│  🔒 Contact details available        │
│     after enrichment                 │
├─────────────────────────────────────┤
│  RESEARCH OPTIONS                    │
│                                      │
│  [🔍 Generate Intelligence Report]   │
│   Full research dossier (2-3 min)    │
│   Uses 1 credit                      │
│                                      │
│  or                                  │
│                                      │
│  [Quick Add to CRM]                  │
│   Add with basic LinkedIn data only  │
└─────────────────────────────────────┘
```

### State 3: Loading States

**While Generating Report:**

```
┌─────────────────────────────────────┐
│  ⏳ Generating Intelligence Report   │
│                                      │
│  [████████████░░░░░░] 65%           │
│                                      │
│  Current: Analyzing investments      │
│  Completed: LinkedIn, News search    │
│  Remaining: Network, Firm research   │
│                                      │
│  This takes 2-3 minutes.             │
│  Continue browsing—we'll notify you. │
└─────────────────────────────────────┘
```

---

## Intelligence Report Structure

### Report Lifecycle

1. **Generation Trigger:**
   - User clicks "Generate Intelligence Report" in side panel
   - Extension sends request to backend
   - Backend initiates Gemini Deep Research
   - Progress updates sent to extension via websocket/polling

2. **Report Storage:**
   - Generated report stored in database
   - Accessible at: `https://reports.nvestiv.com/r/{report_id}`
   - Automatically contributed to intelligence database (all public data)
   - Private notes/tags stay separate

3. **Report Viewing:**
   - Opens in new browser tab
   - Clean, standalone page (not inside Nvestiv app)
   - Formatted as academic research paper
   - Professional PDF export available

### Two Action Options

From side panel when report exists:

1. **View Full Report:** Opens report page (instant, free)
2. **Generate New Report:** Creates fresh version (2-3 min, 1 credit)

From report page:

1. **🔄 Refresh Report:** Regenerates with latest data
2. **✓ Send to CRM:** Enriches contact with structured data

---

## Report Page Design

### Page Structure

```
┌─────────────────────────────────────────────────────────┐
│  STICKY HEADER (Always visible)                         │
├─────────────────────────────────────────────────────────┤
│  [← Back]  John Smith • Sequoia Capital                 │
│                                                          │
│  [🔄 Refresh]  [✓ Send to CRM]  [📥 PDF]  [📤 Share]   │
│                                                          │
│  ⚠ Report is 14 days old • Refresh for latest data      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  REPORT CONTENT (Scrollable)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Subject Header]                                        │
│  [Abstract]                                              │
│  [Table of Contents]                                     │
│  [Section 1: Professional Background]                   │
│  [Section 2: Firm Analysis]                             │
│  [Section 3: Investment Activity]                       │
│  [Section 4: Recent News & Media]                       │
│  [Section 5: Network & Influence]                       │
│  [Section 6: Strategic Relevance]                       │
│  [Bibliography]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Sticky Header Specifications

**Always Visible Elements:**
- Back navigation to LinkedIn
- Primary actions (Refresh, Send to CRM, Download, Share)
- Context reminder (person name + company)
- Status indicator (report age, warnings)

**State-Based Warnings:**
- Report < 7 days old: ✓ "Report is current"
- Report 7-30 days old: ⚠ "Report is X days old. Consider refreshing."
- Report > 30 days old: 🔴 "Report is outdated. Refresh recommended."

### Report Content Layout

**Visual Design:**
- Clean white background
- Generous margins (80px left/right on desktop)
- Readable typography (18px body, Georgia or serif font)
- Section numbers and hierarchy
- Inline citation links (superscript [1], [2])
- Bibliography at end with full source details

**Professional Formatting:**
- Academic paper style
- Clear section hierarchy (H2 for sections, H3 for subsections)
- Stat cards for quick scanning
- Mixed prose + structured data
- Print-friendly for PDF export

---

## Report JSON Schema

### Top-Level Structure

```json
{
  "report_id": "rpt_007_xyz",
  "entity_id": "ent_john_smith_sequoia",
  "version": 7,
  "generated_at": "2025-02-11T14:32:00Z",
  "generated_by_org": "org_family_office_xyz",
  
  "subject": { },
  "abstract": { },
  "sections": [ ],
  "bibliography": { },
  "metadata": { }
}
```

### Subject Object

```json
"subject": {
  "entity_type": "person",
  "full_name": "John Smith",
  "current_title": "Partner",
  "current_company": "Sequoia Capital",
  "location": "San Francisco, CA",
  "profile_photo_url": "https://...",
  "linkedin_url": "https://linkedin.com/in/johnsmith",
  "email": "john@sequoia.com",
  "phone": "+1-415-555-0123"
}
```

### Abstract Object

```json
"abstract": {
  "summary": "John Smith is a Partner at Sequoia Capital with over 15 years of experience...",
  
  "key_findings": [
    "Active in climate tech with 15 investments in the last 24 months",
    "Frequently co-invests with Andreessen Horowitz (8 deals)",
    "Recently raised $500M Fund VI with focus on Series B+ rounds"
  ],
  
  "relevance_score": 9.2,
  "relevance_notes": "Highly aligned with target LP profile..."
}
```

### Section Structure

```json
"sections": [
  {
    "section_id": "sec_001",
    "section_number": 1,
    "title": "Professional Background",
    
    "subsections": [
      {
        "subsection_id": "subsec_001_001",
        "title": "Career Trajectory",
        
        "content": "John Smith has built a distinguished career...[1]. He currently serves as a Partner at Sequoia Capital[2]...",
        
        "structured_data": {
          "career_history": [
            {
              "company": "Sequoia Capital",
              "title": "Partner",
              "start_date": "2018-01",
              "end_date": null,
              "current": true,
              "description": "Leading investments in enterprise software and climate tech",
              "source_ids": [2, 3]
            }
          ]
        },
        
        "citations": [
          {
            "id": 1,
            "text": "Over 15 years in venture capital",
            "source_title": "LinkedIn Profile - John Smith",
            "source_url": "https://linkedin.com/in/johnsmith",
            "accessed_date": "2025-02-11",
            "source_type": "profile"
          }
        ]
      }
    ]
  }
]
```

### Citation Object

```json
{
  "id": 1,
  "citation_number": "[1]",
  "source_title": "Article or Document Title",
  "source_url": "https://...",
  "source_type": "news|database|website|profile|sec_filing|press_release",
  "accessed_date": "2025-02-11",
  "publication_date": "2025-02-05",
  "author": "Author Name",
  "publisher": "Publisher Name"
}
```

### Bibliography Object

```json
"bibliography": {
  "total_sources": 47,
  "sources_by_type": {
    "news": 15,
    "database": 12,
    "website": 10,
    "profile": 5,
    "sec_filing": 3,
    "press_release": 2
  },
  
  "all_sources": [
    {
      "id": 1,
      "citation_number": "[1]",
      "source_title": "LinkedIn Profile - John Smith",
      "source_url": "https://linkedin.com/in/johnsmith",
      "source_type": "profile",
      "accessed_date": "2025-02-11",
      "publication_date": null,
      "author": null,
      "publisher": "LinkedIn"
    }
  ]
}
```

### Metadata Object

```json
"metadata": {
  "generation_time_seconds": 147,
  "ai_model": "gemini-2.0-flash-thinking-exp-01-21",
  "total_tokens": 125000,
  "sources_analyzed": 47,
  "last_refreshed": "2025-02-11T14:32:00Z",
  "next_suggested_refresh": "2025-03-11T14:32:00Z",
  "quality_score": 8.7,
  "completeness_score": 0.92,
  
  "confidence_scores": {
    "professional_background": 0.99,
    "investment_activity": 0.95,
    "network_analysis": 0.78,
    "recent_news": 0.92,
    "firm_analysis": 0.96
  }
}
```

---

## Content Rendering Approach

### Mixed Format: Prose + Structured Data

**Goal:** Professional readability with scannable insights

#### Example: Investment Activity Section

**HTML Structure:**

```html
<section id="section-003" class="report-section">
  <h2>3. Investment Activity (Last 24 Months)</h2>
  
  <!-- Stat Cards for Quick Scanning -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">23</div>
      <div class="stat-label">Total Investments</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">$1.2B</div>
      <div class="stat-label">Capital Deployed</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">$52M</div>
      <div class="stat-label">Avg Check Size</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">Series B</div>
      <div class="stat-label">Primary Stage</div>
    </div>
  </div>
  
  <!-- Narrative Prose with Inline Citations -->
  <div class="narrative">
    <h3>Recent Investment Activity</h3>
    <p>
      In the past 24 months, John Smith has demonstrated consistent 
      investment activity, leading or participating in 23 investments 
      totaling approximately $1.2B in deployed capital<sup><a href="#citation-17">[17]</a></sup>. 
      His investment strategy shows clear sector focus, with enterprise 
      software comprising 40% of deals, followed by fintech (30%) and 
      climate tech (20%)<sup><a href="#citation-18">[18]</a></sup>.
    </p>
    
    <p>
      Notable recent investments include ClimateOS, which raised a $75M 
      Series B in January 2025 with Sequoia leading<sup><a href="#citation-19">[19]</a></sup>. 
      Smith joined the board and has publicly stated that climate 
      infrastructure represents a "generational opportunity"<sup><a href="#citation-20">[20]</a></sup>.
    </p>
  </div>
  
  <!-- Featured Investments Table -->
  <div class="featured-investments">
    <h3>Featured Investments</h3>
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Round</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>ClimateOS</strong><br><small>Climate Tech</small></td>
          <td>Series B</td>
          <td>$75M</td>
          <td>Jan 2025</td>
          <td>Lead, Board</td>
        </tr>
        <tr>
          <td><strong>FinanceAI</strong><br><small>Fintech</small></td>
          <td>Series C</td>
          <td>$120M</td>
          <td>Nov 2024</td>
          <td>Lead</td>
        </tr>
        <tr>
          <td><strong>DataStream</strong><br><small>Enterprise SaaS</small></td>
          <td>Series B</td>
          <td>$50M</td>
          <td>Sep 2024</td>
          <td>Co-Lead</td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <!-- Co-Investment Analysis -->
  <div class="narrative">
    <h3>Co-Investment Patterns</h3>
    <p>
      Analysis reveals strong syndicate relationships with leading venture 
      firms. Smith most frequently co-invests with Andreessen Horowitz 
      (8 deals)<sup><a href="#citation-21">[21]</a></sup> and Lightspeed 
      Ventures (6 deals)<sup><a href="#citation-22">[22]</a></sup>.
    </p>
  </div>
  
  <!-- Co-Investor Network Visualization -->
  <div class="co-investor-chart">
    <h4>Frequent Co-Investors</h4>
    <div class="bar-chart">
      <div class="bar" style="width: 80%">
        <span class="label">Andreessen Horowitz</span>
        <span class="value">8 deals</span>
      </div>
      <div class="bar" style="width: 60%">
        <span class="label">Lightspeed Ventures</span>
        <span class="value">6 deals</span>
      </div>
      <div class="bar" style="width: 40%">
        <span class="label">Founders Fund</span>
        <span class="value">4 deals</span>
      </div>
    </div>
  </div>
</section>
```

**Rendering Principles:**

1. **Lead with quick-scan data** (stat cards, charts)
2. **Follow with narrative context** (prose with citations)
3. **Support with detailed tables** (when appropriate)
4. **Alternate formats** to maintain engagement
5. **Always cite sources** inline with superscript links

### Citation Rendering

**In Content:**
```
He currently serves as a Partner at Sequoia Capital[2].
```

**Rendered As:**
```html
He currently serves as a Partner at Sequoia Capital<sup><a href="#citation-2" class="citation-link">[2]</a></sup>.
```

**In Bibliography:**
```
[2] "Sequoia Capital - Team Page." Sequoia Capital. Accessed Feb 11, 2025.
    https://sequoiacap.com/team/john-smith
```

---

## Intelligence Database Architecture

### Core Concept: Crowdsourced Intelligence

Every generated report automatically contributes to a shared intelligence database (public data only, private notes excluded).

**Benefits:**

1. **Cost Reduction:** Access existing reports for free
2. **Network Effects:** More users = more coverage
3. **Data Quality:** Multiple sources increase confidence
4. **Time Savings:** Instant access vs. 2-3 min generation

### Database Schema

#### Entities Table

```sql
CREATE TABLE entities (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT, -- 'person', 'company', 'fund'
  
  canonical_data JSONB, -- Master profile synthesized from all reports
  
  intelligence_summary JSONB -- {
    -- total_reports INT,
    -- unique_contributors INT,
    -- last_updated TIMESTAMP,
    -- total_views INT,
    -- average_quality_score FLOAT,
    -- data_confidence JSONB
  -- }
);
```

#### Reports Table

```sql
CREATE TABLE reports (
  report_id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(entity_id),
  
  generated_by_org TEXT,
  generated_by_user TEXT,
  generated_at TIMESTAMP,
  
  visibility TEXT, -- 'private', 'shared', 'public'
  
  report_content JSONB, -- Full JSON structure
  
  metadata JSONB,
  usage_stats JSONB
);
```

#### Entity Versions Table

```sql
CREATE TABLE entity_versions (
  entity_id TEXT REFERENCES entities(entity_id),
  version_number INT,
  report_id TEXT REFERENCES reports(report_id),
  timestamp TIMESTAMP,
  changes JSONB
);
```

### Report Contribution Flow

**When user generates a new report:**

1. Check if entity exists: `GET /api/intelligence/exists?entity=john-smith-sequoia`
2. If exists, return existing report metadata
3. If new or refresh requested, generate report
4. Store report with `visibility: 'shared'` (default)
5. Extract structured data and update entity master profile
6. Increment version number
7. Make available to all platform users

**Privacy Model:**

- **Shared by default:** Factual data from public sources
- **Excluded:** User's private notes, internal tags, deal context
- **User control:** Can mark specific reports as private

### Versioning System

When the same entity is researched multiple times:

```json
{
  "entity_id": "ent_john_smith_sequoia",
  "versions": [
    {
      "version_id": "v7",
      "report_id": "rpt_007_xyz",
      "generated_by": "Family Office XYZ",
      "generated_at": "2025-02-11",
      "changes": ["Added 3 new investments", "Updated sector focus"]
    },
    {
      "version_id": "v6",
      "report_id": "rpt_006_abc",
      "generated_by": "Pension Fund ABC",
      "generated_at": "2025-01-28",
      "changes": ["Initial comprehensive report"]
    }
  ]
}
```

**Master Profile:** Synthesized "best data" from all versions with confidence scores

---

## Technical Architecture

### Extension Components

#### 1. Content Script

**Responsibilities:**
- Runs on every LinkedIn page
- Extracts profile data from DOM
- Detects page type (profile, company, feed)
- Sends extracted data to background worker

**Key Functions:**
```javascript
extractLinkedInProfile()
detectPageType()
sendToBackground(data)
```

#### 2. Background Service Worker

**Responsibilities:**
- Manages API calls to Nvestiv backend
- Handles authentication state
- Coordinates between content script and side panel
- Manages websocket connections for real-time updates

**Key Functions:**
```javascript
authenticateUser()
checkIntelligence(profileData)
generateReport(entityId)
pollReportStatus(jobId)
```

#### 3. Side Panel

**Responsibilities:**
- Displays UI to user
- Shows intelligence preview
- Triggers report generation
- Provides CRM actions

**Key Functions:**
```javascript
renderProfile(data)
showLoadingState()
openReportTab(reportId)
sendToCRM(contactData)
```

#### 4. Report Page

**Responsibilities:**
- Standalone HTML page
- Renders full intelligence report
- Provides actions (refresh, send to CRM, download)
- Formats for print/PDF

**URL Structure:**
```
https://reports.nvestiv.com/r/{report_id}
```

### API Endpoints

#### Authentication

```
POST /api/auth/extension/login
POST /api/auth/extension/refresh-token
POST /api/auth/extension/logout
```

#### Intelligence

```
GET  /api/intelligence/exists?entity={linkedin_url}
POST /api/intelligence/generate
GET  /api/intelligence/report/{report_id}
GET  /api/intelligence/status/{job_id}
POST /api/intelligence/refresh/{report_id}
```

#### CRM Integration

```
POST /api/crm/contacts/enrich
GET  /api/crm/contacts/{contact_id}
```

### Data Flow: Generate New Report

```
1. User on LinkedIn profile
   ↓
2. Content Script extracts profile data
   ↓
3. Sends to Background Worker
   ↓
4. Background → POST /api/intelligence/generate
   ↓
5. Backend starts Gemini Deep Research job
   Returns: { job_id: "job_123" }
   ↓
6. Background polls: GET /api/intelligence/status/job_123
   Returns: { status: "processing", progress: 65% }
   ↓
7. Side panel shows progress bar
   ↓
8. When complete, open new tab:
   https://reports.nvestiv.com/r/rpt_abc123
   ↓
9. Report page loads via: GET /api/intelligence/report/rpt_abc123
   ↓
10. Render formatted report
```

### Chrome APIs Used

```javascript
// Side Panel
chrome.sidePanel.setOptions()
chrome.sidePanel.open()

// Storage
chrome.storage.local.set()
chrome.storage.local.get()

// Messaging
chrome.runtime.sendMessage()
chrome.runtime.onMessage.addListener()

// Tabs
chrome.tabs.create()
chrome.tabs.query()
```

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-2)

**Scope:**
- LinkedIn profile extraction (people only)
- Basic side panel UI
- Authentication flow
- Existing report viewing
- New report generation

**Deliverables:**
- Chrome extension installable
- Side panel functional
- Report page rendering
- Backend API endpoints

**Success Criteria:**
- User can view LinkedIn profile
- Panel shows extracted data
- Can generate and view report
- Can send basic data to CRM

### Phase 2: Polish & Intelligence Database (Weeks 3-4)

**Scope:**
- Data masking/teaser in side panel
- Report refresh functionality
- Intelligence database contribution
- PDF export
- Improved report formatting

**Deliverables:**
- Masked contact data in panel
- "View existing" vs "generate new" flow
- Reports stored and queryable
- PDF download working

**Success Criteria:**
- Conversion-optimized UI
- Report reuse working
- Multiple users can access same reports
- Professional PDF output

### Phase 3: Advanced Features (Month 2)

**Scope:**
- Company page detection
- PitchBook/Preqin enrichment
- Co-investor mapping
- Intelligence Explorer dashboard
- Advanced search

**Deliverables:**
- Company intelligence reports
- Enriched GP data
- Network visualization
- Platform-wide search

**Success Criteria:**
- Company reports generated
- Investment data integrated
- Users can search database
- Network effects visible

### Phase 4: Scale & Optimize (Month 3+)

**Scope:**
- News article entity extraction
- Bulk operations
- Mobile companion (optional)
- Advanced analytics
- API for external integrations

---

## Success Metrics

### User Engagement

- **Activation Rate:** % of installers who authenticate
- **Daily Active Users:** Users opening extension daily
- **Reports Generated:** Total reports created per month
- **Report Reuse Rate:** % using existing vs. generating new

### Intelligence Database

- **Coverage:** Total unique entities researched
- **Contribution Rate:** % of reports shared vs. private
- **Reuse Savings:** Credits saved by using existing reports
- **Data Freshness:** Average age of reports

### Business Impact

- **CRM Enrichment:** Contacts added/updated via extension
- **Time Savings:** Hours saved vs. manual research
- **Credit Usage:** Credits consumed vs. earned (contribution)
- **User Retention:** 7-day, 30-day retention rates

---

## Design Assets Needed

### Side Panel

- Nvestiv logo (SVG)
- Loading animations
- Stat card designs
- Button styles
- Lock icons (masked data)

### Report Page

- Header logo
- Citation link styles
- Table formatting
- Stat card designs
- Print/PDF stylesheet

### Marketing

- Extension icon (16x16, 32x32, 48x48, 128x128)
- Chrome Web Store screenshots
- Demo video assets
- Promotional graphics

---

## Open Questions & Decisions

1. **Rate Limiting:** How many reports can a user generate per day/month?
2. **Credit System:** Pricing structure for report generation?
3. **Data Retention:** How long to store reports? Archive policy?
4. **Privacy Controls:** Can users delete contributed reports?
5. **Quality Control:** How to handle low-quality or spam reports?
6. **Mobile Strategy:** Chrome extension or separate mobile app?
7. **Competitive Intelligence:** Allow private-only mode for sensitive research?
8. **Team Sharing:** Can reports be shared within organization only?

---

## Next Steps

1. **Finalize CRM schema** for enrichment mapping
2. **Design high-fidelity mockups** for side panel and report page
3. **Set up development environment** with Chrome extension boilerplate
4. **Implement authentication flow** and backend endpoints
5. **Build LinkedIn extraction** logic
6. **Create report generation** pipeline with Gemini
7. **Develop report rendering** system
8. **Test with pilot users** and iterate

---

**Document Version:** 1.0  
**Last Updated:** February 11, 2025  
**Status:** Ready for Implementation
