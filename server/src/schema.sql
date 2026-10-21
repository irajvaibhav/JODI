-- Applied on every boot; every statement is idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  google_id text UNIQUE,
  email text,
  dob date,                          -- private: only used to derive age, never returned for other users
  onboarded boolean NOT NULL DEFAULT false,
  discoverable boolean NOT NULL DEFAULT true,
  banned boolean NOT NULL DEFAULT false,
  push_token text,
  notif jsonb NOT NULL DEFAULT '{"matches":true,"messages":true,"daily":true,"quietStart":23,"quietEnd":8}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text, gender text, bio text, city text,
  lat double precision, lng double precision,
  profession text, education text,
  interests text[] NOT NULL DEFAULT '{}',
  personality jsonb NOT NULL DEFAULT '{}',
  lifestyle jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exact birth details are AES-GCM encrypted (birth_enc). Only derived, high-level attributes are stored in clear.
CREATE TABLE IF NOT EXISTS astro (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_enc text,
  time_known boolean NOT NULL DEFAULT false,
  sun text, moon text, rising text, nakshatra int, element text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  genders text[] NOT NULL DEFAULT '{}',
  age_min int NOT NULL DEFAULT 18,
  age_max int NOT NULL DEFAULT 35,
  max_km int NOT NULL DEFAULT 50,
  intent text
);

-- ponytail: images live in Postgres; move to object storage + CDN past a few thousand users.
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,                -- profile | chat
  position int NOT NULL DEFAULT 0,
  mime text NOT NULL,
  data bytea NOT NULL,
  status text NOT NULL DEFAULT 'approved', -- approved | rejected
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_owner ON media(owner_id, kind, position);

CREATE TABLE IF NOT EXISTS swipes (
  swiper uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,              -- jodi | pass
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (swiper, target)
);
CREATE INDEX IF NOT EXISTS swipes_target ON swipes(target, action);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score int,
  share_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  unmatched_at timestamptz,
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text,
  media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  flagged text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_match ON messages(match_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter uuid REFERENCES users(id) ON DELETE SET NULL,  -- null = raised by automated moderation
  reported uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_cosmic (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  target_id uuid REFERENCES users(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Product analytics + audit log in one stream; names prefixed "audit." are security events.
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_name ON events(name, created_at);
