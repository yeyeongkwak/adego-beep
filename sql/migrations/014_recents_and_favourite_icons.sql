-- Recent places for signed-in users (src/hooks/useRecent.ts) and a chosen
-- icon on favourites (home, school, ...). Written only by our API with the
-- secret key, like favorite_locations. Idempotent.

CREATE TABLE IF NOT EXISTS public.recent_places (
  user_id     uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  place_type  text NOT NULL,
  place_id    text NOT NULL,
  label       text NOT NULL,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  mode        text,
  code        text,
  visited_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_type, place_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_places_user_visited
  ON public.recent_places (user_id, visited_at DESC);

ALTER TABLE public.recent_places ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the secret key reads or writes.
REVOKE ALL ON TABLE public.recent_places FROM anon, authenticated;

-- Icon key for a favourite (see FAVOURITE_ICONS). Null = default icon.
ALTER TABLE public.favorite_locations ADD COLUMN IF NOT EXISTS icon text;
