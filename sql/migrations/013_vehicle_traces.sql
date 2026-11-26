-- Where buses on a detour actually drove. The feeds give no detour path, so
-- scripts/collect-traces.ts samples live positions of routes with a detour
-- notice, and the map can draw them later. Kept 1 day. Idempotent.

CREATE TABLE IF NOT EXISTS public.vehicle_traces (
  route_id     text             NOT NULL,
  trip_id      text             NOT NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  recorded_at  timestamptz      NOT NULL,
  PRIMARY KEY (trip_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS vehicle_traces_route_time
  ON public.vehicle_traces (route_id, recorded_at);

-- Only the collector (secret key) writes; the app reads with anon.
ALTER TABLE public.vehicle_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.vehicle_traces;
CREATE POLICY "public read" ON public.vehicle_traces FOR SELECT USING (true);
