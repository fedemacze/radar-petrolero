CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  region text NOT NULL,
  priority text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  dry_run boolean NOT NULL,
  summary jsonb,
  error text
);

CREATE TABLE IF NOT EXISTS articles (
  id bigserial PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id),
  source_name text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  normalized_url text NOT NULL,
  published_at timestamptz,
  content text NOT NULL,
  content_hash text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  first_run_id uuid REFERENCES runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_url),
  UNIQUE(source_id, content_hash)
);

CREATE TABLE IF NOT EXISTS events (
  event_key text PRIMARY KEY,
  primary_article_id bigint REFERENCES articles(id),
  title text NOT NULL,
  prefilter jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_articles (
  event_key text NOT NULL REFERENCES events(event_key) ON DELETE CASCADE,
  article_id bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  PRIMARY KEY(event_key, article_id)
);

CREATE TABLE IF NOT EXISTS opportunities (
  event_key text PRIMARY KEY REFERENCES events(event_key) ON DELETE CASCADE,
  opportunity jsonb NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer NOT NULL,
  response_id text,
  attio_record_id text,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE IF NOT EXISTS sync_attempts (
  id bigserial PRIMARY KEY,
  event_key text NOT NULL REFERENCES events(event_key) ON DELETE CASCADE,
  run_id uuid REFERENCES runs(id),
  action text NOT NULL,
  status text NOT NULL,
  attio_record_id text,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS events_last_seen_at_idx ON events(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS sync_attempts_event_key_idx ON sync_attempts(event_key, attempted_at DESC);

CREATE TABLE IF NOT EXISTS contract_reviews (
  article_id bigint PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  relevant boolean NOT NULL,
  finding jsonb NOT NULL,
  base_end_date date,
  option_end_date date,
  confidence integer NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_reviews_expiry_idx ON contract_reviews(base_end_date, option_end_date);

CREATE TABLE IF NOT EXISTS contacts (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  normalized_company text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  internal_owner text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'csv',
  source_key text NOT NULL,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source, source_key)
);

CREATE TABLE IF NOT EXISTS opportunity_followups (
  event_key text PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('pending','contacted','replied','discarded')),
  contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  contacted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opportunity_followups ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_company_idx ON contacts(normalized_company);
