-- EduOS shared application state (MVP: single JSON document, same shape as localStorage blob)
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_state_updated_at_idx ON app_state (updated_at DESC);
