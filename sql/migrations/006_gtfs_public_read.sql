-- gtfs_* tables are read-only reference data queried by the anon
-- (publishable) key from client-side API routes — RLS was on with no
-- policy, so anon reads silently returned 0 rows. Only the import script
-- (secret key, bypasses RLS) writes to these. Idempotent.

ALTER TABLE public.gtfs_routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_calendar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_calendar_dates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stop_times      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_shapes          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON public.gtfs_routes;
CREATE POLICY "public read" ON public.gtfs_routes FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_stops;
CREATE POLICY "public read" ON public.gtfs_stops FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_calendar;
CREATE POLICY "public read" ON public.gtfs_calendar FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_calendar_dates;
CREATE POLICY "public read" ON public.gtfs_calendar_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_trips;
CREATE POLICY "public read" ON public.gtfs_trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_stop_times;
CREATE POLICY "public read" ON public.gtfs_stop_times FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read" ON public.gtfs_shapes;
CREATE POLICY "public read" ON public.gtfs_shapes FOR SELECT USING (true);
