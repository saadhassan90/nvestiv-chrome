# Intelligence Report to CRM Mapping

## Entity Type Detection

| Report `entity_type` | CRM Schema | Notes |
|---------------------|-----------|-------|
| `person` + investor role | `CRM_investor_individual` | Individual making investments |
| `person` + other role | `CRM_people` | General contact |
| `company` + investor type | `CRM_investor_company` | LP/allocator firm |
| `company` + manager type | `CRM_manager` | GP/fund manager |
| `company` + startup | `CRM_startup` | Portfolio company |
| `company` + other | `CRM_generic_company` | General company |

## Core Mapping: Person Entity

### CRM_people (General Contact)

| Report Path | CRM Field | Transform |
|------------|-----------|-----------|
| `subject.full_name` | `full_name` | Direct |
| `subject.email` | `email` | Direct |
| `subject.phone` | `phone` | Direct |
| `subject.linkedin_url` | `linkedin_url` | Direct |
| `subject.current_title` | `title` | Direct |
| `subject.location` | `city`, `state_or_region`, `country` | Parse location string |
| `abstract.summary` | `bio` | Direct |
| `sections[sec_005].structured_data.network_metrics.influence_score` | `network_influence` | Convert to description |
| `sections[sec_003].structured_data.investment_summary.sectors[]` | `key_investment_interests` | Array |

### CRM_investor_individual (Individual Investor)

| Report Path | CRM Field | Transform |
|------------|-----------|-----------|
| `subject.full_name` | Split to `first_name`, `last_name` | Parse name |
| `subject.email` | `email` | Direct |
| `subject.phone` | `phone` | Direct |
| `subject.linkedin_url` | `linkedin_url` | Direct |
| `subject.current_title` | `position` | Direct |
| `subject.current_company` | `company_affiliation` | Direct |
| `sections[sec_003].structured_data.investment_summary.check_size_avg` | `preferred_ticket_size_min`, `preferred_ticket_size_max` | Calculate range (±30%) |
| `sections[sec_003].structured_data.investment_summary.sectors[]` | `preferred_asset_classes` | Map sectors to asset classes |
| `sections[sec_003].structured_data.investment_summary.stage_breakdown` | `investment_stage` | Primary stage |
| `sections[sec_003].structured_data.investment_summary.geographic_focus[]` | `geographic_focus` | Array |

## Core Mapping: Company Entity

### CRM_investor_company (LP/Allocator)

| Report Path | CRM Field | Transform |
|------------|-----------|-----------|
| `subject.full_name` | `company_name`, `company_legal_name` | Direct |
| `subject.email` | `email` | Direct |
| `subject.phone` | `phone` | Direct |
| `subject.linkedin_url` | `linkedin_url` | Direct |
| `subject.location` | `location` | Direct |
| `sections[sec_002].structured_data.firm_metrics.aum` | `total_aum` | Direct |
| `sections[sec_003].structured_data.investment_summary.check_size_avg` | `average_ticket_size` | Direct |
| `sections[sec_003].structured_data.investment_summary.sectors[]` | `preferred_asset_classes` | Array |
| `sections[sec_003].structured_data.investment_summary.geographic_focus[]` | `geographic_focus` | Array |
| `sections[sec_003].structured_data.investment_summary.stage_breakdown` | `investment_stage` | Primary stage |
| `sections[sec_002].structured_data.firm_details.investment_thesis` | `investment_mandates` | Direct |
| `sections[sec_003].structured_data.recent_investments[]` | `recent_investments` | Format as list |

### CRM_manager (GP/Fund Manager)

| Report Path | CRM Field | Transform |
|------------|-----------|-----------|
| `subject.full_name` | `company_legal_name` | Direct |
| `subject.email` | `email` | Direct |
| `subject.phone` | `phone` | Direct |
| `subject.linkedin_url` | `linkedin_url` | Direct |
| `sections[sec_002].structured_data.firm_metrics.aum` | `total_aum` | Direct |
| `sections[sec_002].structured_data.firm_details.asset_classes[]` | `asset_classes` | Array |
| `sections[sec_003].structured_data.portfolio_companies[]` | `notable_portfolio_companies` | Format as list |
| `sections[sec_002].structured_data.firm_details.investment_thesis` | `investment_thesis` | Direct |
| `sections[sec_002].structured_data.firm_details.management_fee` | `management_fee` | Percentage |
| `sections[sec_002].structured_data.firm_details.carried_interest` | `carried_interest` | Percentage |
| `sections[sec_002].structured_data.firm_details.hurdle_rate` | `hurdle_rate` | Percentage |

### CRM_generic_company (General)

| Report Path | CRM Field | Transform |
|------------|-----------|-----------|
| `subject.full_name` | `company_name`, `company_legal_name` | Direct |
| `subject.email` | `email` | Direct |
| `subject.phone` | `phone` | Direct |
| `subject.linkedin_url` | `linkedin_url` | Direct |
| `subject.location` | Parse to `city`, `state_or_region`, `country` | Parse location |
| `abstract.summary` | `detailed_description` | Direct |
| `sections[sec_002].structured_data.firm_details.year_founded` | `year_established` | Direct |
| `sections[sec_002].structured_data.firm_metrics.employee_count` | `total_full_time_team_members` | Direct |

## Special Tabs

### Due Diligence Tab

**Full Report Storage:**

```javascript
{
  // Store complete report JSON
  "report_id": "rpt_xyz789",
  "report_url": "https://reports.nvestiv.com/r/rpt_xyz789",
  "generated_at": "2025-02-11T14:32:00Z",
  
  // Machine-readable (backend)
  "report_data": { /* Complete report JSON */ },
  
  // Rich text (frontend rendering)
  "report_html": "<!-- Rendered HTML from report sections -->"
}
```

**What Gets Stored:**
- Complete report JSON → Backend database
- Rendered HTML version → Displayed to user
- Link to full report page → Quick access

### Notes Tab

Auto-populated from:
- `abstract.key_findings[]` → Bulleted list
- `sections[sec_006].structured_data.strategic_insights` → Strategic notes

### Meetings Tab

Integration point:
- Fireflies transcripts can reference intelligence report
- Meeting notes can link to report sections

## Default Field Values

**Auto-populated on enrichment:**

| CRM Field | Default Value | Source |
|-----------|--------------|--------|
| `priority_level` | Calculate from `abstract.relevance_score` | High (8-10), Medium (5-7), Low (0-4) |
| `last_contact_date` | Current timestamp | System |
| `engagement_stage` | "prospect" | Default for new |
| `created` | Current timestamp | System |

## Mapping Implementation

```typescript
class IntelligenceTosCRMMapper {
  
  mapToCRM(report: Report): CRMRecord {
    // 1. Detect entity type and schema
    const schema = this.detectCRMSchema(report);
    
    // 2. Map core fields
    const coreFields = this.mapCoreFields(report, schema);
    
    // 3. Map entity-specific fields
    const specificFields = this.mapSpecificFields(report, schema);
    
    // 4. Generate default values
    const defaults = this.generateDefaults(report);
    
    return {
      schema_type: schema,
      fields: { ...coreFields, ...specificFields, ...defaults }
    };
  }
  
  detectCRMSchema(report: Report): string {
    const entityType = report.subject.entity_type;
    const role = this.extractRole(report);
    
    if (entityType === 'person') {
      return this.isInvestor(report) 
        ? 'CRM_investor_individual' 
        : 'CRM_people';
    }
    
    if (entityType === 'company') {
      if (this.isInvestor(report)) return 'CRM_investor_company';
      if (this.isManager(report)) return 'CRM_manager';
      if (this.isStartup(report)) return 'CRM_startup';
      return 'CRM_generic_company';
    }
    
    return 'CRM_generic_company';
  }
}
```

## Enrichment Strategy

**When sending to CRM:**

1. **New Contact:** Create new record with all mapped fields
2. **Existing Contact:** Merge strategy:
   - **Overwrite:** `bio`, `detailed_description` (if report is newer)
   - **Append:** `key_investment_interests`, `preferred_asset_classes` (add new items)
   - **Skip:** `email`, `phone` (never overwrite user-entered)
   - **Calculate Max:** `total_aum` (keep higher value)

**Store in Due Diligence Tab:**
- Full report JSON (machine-readable)
- Rendered HTML (user-readable)
- Report metadata (ID, URL, timestamp, quality score)

## Notes

- All mappings assume report follows the structure from Product Spec
- Location parsing: "San Francisco, CA" → city="San Francisco", state_or_region="CA", country="USA"
- Array fields: Combine multiple report sources into single array
- Percentage fields: Convert decimal (0.02) to percentage (2.0)
- Dollar amounts: Store as numbers without formatting
