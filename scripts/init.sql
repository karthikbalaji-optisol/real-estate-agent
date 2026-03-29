CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level_enum') THEN
    CREATE TYPE log_level_enum AS ENUM ('info', 'warn', 'error', 'debug');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_service_enum') THEN
    CREATE TYPE log_service_enum AS ENUM ('nestjs-api', 'python');
  END IF;
END
$$;

-- Emails
CREATE TABLE IF NOT EXISTS emails (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                  VARCHAR NOT NULL UNIQUE,
  encrypted_app_password VARCHAR NOT NULL,
  provider               VARCHAR NOT NULL DEFAULT 'google',
  enabled                BOOLEAN NOT NULL DEFAULT TRUE,
  is_valid               BOOLEAN DEFAULT NULL,
  last_checked_at        TIMESTAMPTZ DEFAULT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url          VARCHAR NOT NULL UNIQUE,
  bhk          INTEGER,
  bathrooms    INTEGER,
  price        VARCHAR,
  plot_area    VARCHAR,
  built_up_area VARCHAR,
  location     VARCHAR,
  facing       VARCHAR,
  floors       INTEGER,
  source_email VARCHAR,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR NOT NULL,
  type       VARCHAR NOT NULL DEFAULT 'daily',
  file_path  VARCHAR,
  content    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_status_enum') THEN
    CREATE TYPE trigger_status_enum AS ENUM ('pending', 'running', 'completed', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS manual_triggers (
  request_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status      trigger_status_enum NOT NULL DEFAULT 'pending',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ DEFAULT NULL,
  accounts_checked INTEGER DEFAULT 0,
  emails_found     INTEGER DEFAULT 0,
  urls_extracted   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS manual_trigger_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES manual_triggers(request_id) ON DELETE CASCADE,
  level       VARCHAR NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_trigger_logs_request ON manual_trigger_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_manual_triggers_started     ON manual_triggers (started_at DESC);

-- Logs
CREATE TABLE IF NOT EXISTS logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level     log_level_enum NOT NULL,
  service   log_service_enum NOT NULL,
  context   VARCHAR NOT NULL,
  message   TEXT NOT NULL,
  metadata  JSONB,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_level     ON logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_service   ON logs (service);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);
