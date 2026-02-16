-- ============================================================
-- Nvestiv Intelligence Database Schema
-- ============================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Core Tables
-- ============================================================

-- Organizations (mirrors main app)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities (persons, companies tracked by the system)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  linkedin_url TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'company')),
  canonical_data JSONB DEFAULT '{}',
  last_scraped_at TIMESTAMPTZ,
  scraped_by_count INTEGER DEFAULT 0,
  total_reports INTEGER DEFAULT 0,
  latest_report_id UUID,
  latest_report_at TIMESTAMPTZ,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_linkedin_url ON entities (linkedin_url);
CREATE INDEX IF NOT EXISTS idx_entities_org_id ON entities (org_id);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities (entity_type);

-- Reports (generated intelligence reports)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_org UUID NOT NULL,
  report_content JSONB NOT NULL,
  subject JSONB,
  abstract JSONB,
  bibliography JSONB,
  metadata JSONB,
  view_count INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_entity_id ON reports (entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON reports (generated_by_org);

-- Entity Versions (change tracking)
CREATE TABLE IF NOT EXISTS entity_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  version_data JSONB NOT NULL,
  change_source TEXT NOT NULL CHECK (change_source IN ('scrape', 'report', 'manual', 'crm')),
  report_id UUID REFERENCES reports(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_versions_entity_id ON entity_versions (entity_id);

-- Report Jobs (async job tracking)
CREATE TABLE IF NOT EXISTS report_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  completed_steps JSONB DEFAULT '[]',
  remaining_steps JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  report_id UUID REFERENCES reports(id),
  report_url TEXT,
  error_message TEXT,
  org_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_entity_id ON report_jobs (entity_id);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs (status);
CREATE INDEX IF NOT EXISTS idx_report_jobs_org ON report_jobs (org_id);

-- ============================================================
-- Embedding Tables (pgvector)
-- ============================================================

-- Entity-level embeddings (one per entity)
CREATE TABLE IF NOT EXISTS entity_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  text_content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_entity_embedding UNIQUE (entity_id)
);

-- Report section embeddings
CREATE TABLE IF NOT EXISTS report_section_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_section_embeddings_report ON report_section_embeddings (report_id);

-- Citation embeddings
CREATE TABLE IF NOT EXISTS citation_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  citation_id INTEGER NOT NULL,
  embedding vector(1536) NOT NULL,
  text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_embeddings_report ON citation_embeddings (report_id);

-- ============================================================
-- Vector Search Indexes (HNSW)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entity_embeddings_hnsw
  ON entity_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_section_embeddings_hnsw
  ON report_section_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RPC Functions for Vector Search
-- ============================================================

-- Search similar entities by embedding
CREATE OR REPLACE FUNCTION search_similar_entities(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  entity_id UUID,
  linkedin_url TEXT,
  entity_type TEXT,
  canonical_data JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entity_id,
    e.linkedin_url,
    e.entity_type,
    e.canonical_data,
    1 - (ee.embedding <=> query_embedding) AS similarity
  FROM entity_embeddings ee
  JOIN entities e ON e.id = ee.entity_id
  WHERE 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Retrieve report sections by similarity
CREATE OR REPLACE FUNCTION retrieve_report_sections(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  report_id UUID,
  section_id TEXT,
  subsection_id TEXT,
  text_content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    rse.report_id,
    rse.section_id,
    rse.subsection_id,
    rse.text_content,
    1 - (rse.embedding <=> query_embedding) AS similarity
  FROM report_section_embeddings rse
  WHERE 1 - (rse.embedding <=> query_embedding) > match_threshold
  ORDER BY rse.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Updated At Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_report_jobs_updated_at
  BEFORE UPDATE ON report_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
