-- Per-center storage. Replaces the single shared app_state document.

CREATE TABLE centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'trial',
  owner_user_id TEXT,
  -- Profile and public listing fields (city, phone, tagline, subjects, ...)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX centers_slug_idx ON centers (slug);

-- Existing auth_users rows may point at centers that were never saved, so the
-- constraint applies to new and changed rows only. 002 backfills the missing centers.
ALTER TABLE auth_users
  ADD CONSTRAINT auth_users_center_fk FOREIGN KEY (center_id) REFERENCES centers (id) NOT VALID;

-- Every app collection (students, batches, attendance, ...) lives here, one row per record.
-- owner_ref is the batch, teacher or student a record belongs to (see js/sync-rules.js).
CREATE TABLE records (
  center_id TEXT NOT NULL REFERENCES centers (id),
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  owner_ref TEXT,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (center_id, collection, id)
);

CREATE INDEX records_live_idx ON records (center_id, collection) WHERE deleted_at IS NULL;
CREATE INDEX records_owner_idx ON records (center_id, collection, owner_ref) WHERE deleted_at IS NULL;

-- API secrets per center, encrypted (used from Stage 5). Never sent to browsers.
CREATE TABLE center_secrets (
  center_id TEXT PRIMARY KEY REFERENCES centers (id),
  openai_api_key_enc TEXT,
  whatsapp_token_enc TEXT,
  whatsapp_phone_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Developer API keys: only a hash and a short prefix are stored (used from Stage 5).
CREATE TABLE center_api_keys (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers (id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX center_api_keys_center_idx ON center_api_keys (center_id);

-- Inquiries from the public marketplace (used from Stage 6).
CREATE TABLE public_inquiries (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers (id),
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX public_inquiries_center_idx ON public_inquiries (center_id, created_at DESC);

-- Who changed what, for platform-owner actions and other sensitive writes.
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  role TEXT,
  center_id TEXT,
  action TEXT NOT NULL,
  collection TEXT,
  record_id TEXT,
  detail JSONB
);

CREATE INDEX audit_log_center_idx ON audit_log (center_id, at DESC);
