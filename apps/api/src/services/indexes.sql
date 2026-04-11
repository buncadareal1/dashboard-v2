-- Missing indexes for 75K+ leads scale
-- Run manually: psql $DATABASE_URL < apps/api/src/services/indexes.sql

-- FK columns on leads table — used in 7-table JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_employee_idx
  ON leads (current_employee_id) WHERE current_employee_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_campaign_idx
  ON leads (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_fanpage_idx
  ON leads (fanpage_id) WHERE fanpage_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_ad_idx
  ON leads (ad_id) WHERE ad_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_adset_idx
  ON leads (adset_id) WHERE adset_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_source_idx
  ON leads (source_id) WHERE source_id IS NOT NULL;

-- Sort by updated_at (mới nhất trước) for Report Data table
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_updated_at_idx
  ON leads (updated_at DESC);

-- projectFanpages FK
CREATE INDEX CONCURRENTLY IF NOT EXISTS project_fanpages_fanpage_idx
  ON project_fanpages (fanpage_id);

-- project_ad_accounts FK
CREATE INDEX CONCURRENTLY IF NOT EXISTS project_ad_accounts_project_idx
  ON project_ad_accounts (project_id);
