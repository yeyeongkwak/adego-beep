-- Journeys opened from the route list, so /route/<id> reopens them on any
-- device. id = hash of origin + destination + rides (computed server-side),
-- so the same journey always maps to the same row.
--
-- RLS on with NO policies: the anon (publishable) key can't read, list or
-- write rows. Only our API routes (secret key, bypasses RLS) touch this
-- table, and they only ever fetch one row by id. Idempotent.

CREATE TABLE IF NOT EXISTS public.saved_journeys (
  id              text PRIMARY KEY,
  journey         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_viewed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_journeys ENABLE ROW LEVEL SECURITY;

-- For a later cleanup job ("delete if unopened for 90 days").
CREATE INDEX IF NOT EXISTS idx_saved_journeys_last_viewed_at
  ON public.saved_journeys (last_viewed_at);
