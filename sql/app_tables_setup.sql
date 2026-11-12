-- App feature tables: profile, trip history, favorites, realtime arrivals, alerts.
-- Run once, after gtfs_staging_setup.sql. Idempotent.

-- 1:1 with auth.users, created by app code on signup — no password column,
-- Supabase Auth (Google OAuth) owns credentials.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users (id),
  emoji_avatar  text DEFAULT '🚌',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trip_history (
  id                    text PRIMARY KEY DEFAULT ('trip_' || gen_random_uuid()::text),
  user_id               uuid NOT NULL REFERENCES auth.users (id),
  destination_place_id  text NOT NULL,
  destination_name      text NOT NULL,
  day_of_week           integer NOT NULL,  -- 0-6
  hour                  integer NOT NULL,  -- 0-23
  dest_longitude        double precision,
  dest_latitude         double precision,
  visit_count           integer NOT NULL DEFAULT 1,
  last_visited_at       timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_history_user_id ON public.trip_history (user_id);

CREATE TABLE IF NOT EXISTS public.favorite_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id),
  label       text NOT NULL,
  is_home     boolean DEFAULT false,
  place_id    text NOT NULL,
  longitude   double precision NOT NULL,
  latitude    double precision NOT NULL,
  address     text,
  place_type  text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_favorite_locations_user_id ON public.favorite_locations (user_id);

CREATE TABLE IF NOT EXISTS public.rt_arrivals (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_id            text,
  stop_id            text,
  route_short_name   text,
  predicted_arrival  timestamptz,
  delay_seconds      integer,
  recorded_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rt_arrivals_trip_stop ON public.rt_arrivals (trip_id, stop_id);

-- Current-state, not a log: PK is the feed's own alert id, so re-fetching upserts.
CREATE TABLE IF NOT EXISTS public.service_alerts (
  id                    text PRIMARY KEY,
  route_id              text,
  effect                text,  -- GTFS-RT Alert.Effect, e.g. DETOUR, NO_SERVICE
  header_text           text,
  description_text      text,
  active_period_start   timestamptz,
  active_period_end     timestamptz,
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_alerts_route_id ON public.service_alerts (route_id);

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rt_arrivals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_alerts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own trip history" ON public.trip_history;
CREATE POLICY "own trip history" ON public.trip_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own favorites" ON public.favorite_locations;
CREATE POLICY "own favorites" ON public.favorite_locations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- rt_arrivals/service_alerts: public read, no write policy — only the
-- service role key (bypasses RLS) writes to these.
DROP POLICY IF EXISTS "public read" ON public.rt_arrivals;
CREATE POLICY "public read" ON public.rt_arrivals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.service_alerts;
CREATE POLICY "public read" ON public.service_alerts
  FOR SELECT USING (true);
