-- Delta on top of 004. Run once against an existing DB.
-- Idempotent, safe to rerun.

-- Still timing out at 5min even after the index rebuild fix in 003 — the
-- bulk load itself (1.7M rows + rebuilding 2 indexes) just takes that long
-- on this DB's compute tier. Bump the budget, and log a timestamp between
-- each phase (visible in Supabase Logs) so if it times out again we know
-- exactly which step is slow instead of guessing.
CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL statement_timeout = '10min';

  RAISE NOTICE '[swap] dropping indexes at %', clock_timestamp();
  DROP INDEX IF EXISTS public.idx_gtfs_stop_times_trip_id;
  DROP INDEX IF EXISTS public.idx_gtfs_stop_times_stop_id;
  DROP INDEX IF EXISTS public.idx_gtfs_shapes_shape_id;

  RAISE NOTICE '[swap] truncating at %', clock_timestamp();
  TRUNCATE
    public.gtfs_stop_times,
    public.gtfs_trips,
    public.gtfs_shapes,
    public.gtfs_calendar_dates,
    public.gtfs_calendar,
    public.gtfs_stops,
    public.gtfs_routes
  CASCADE;

  RAISE NOTICE '[swap] inserting small tables at %', clock_timestamp();
  INSERT INTO public.gtfs_routes          SELECT * FROM public.gtfs_staging_routes;
  INSERT INTO public.gtfs_stops           SELECT * FROM public.gtfs_staging_stops;
  INSERT INTO public.gtfs_calendar        SELECT * FROM public.gtfs_staging_calendar;
  INSERT INTO public.gtfs_calendar_dates  SELECT * FROM public.gtfs_staging_calendar_dates;
  INSERT INTO public.gtfs_trips           SELECT * FROM public.gtfs_staging_trips;

  RAISE NOTICE '[swap] inserting stop_times at %', clock_timestamp();
  INSERT INTO public.gtfs_stop_times      SELECT * FROM public.gtfs_staging_stop_times;

  RAISE NOTICE '[swap] inserting shapes at %', clock_timestamp();
  INSERT INTO public.gtfs_shapes          SELECT * FROM public.gtfs_staging_shapes;

  RAISE NOTICE '[swap] rebuilding indexes at %', clock_timestamp();
  CREATE INDEX idx_gtfs_stop_times_trip_id ON public.gtfs_stop_times (trip_id);
  CREATE INDEX idx_gtfs_stop_times_stop_id ON public.gtfs_stop_times (stop_id);
  CREATE INDEX idx_gtfs_shapes_shape_id    ON public.gtfs_shapes (shape_id);

  RAISE NOTICE '[swap] done at %', clock_timestamp();
END;
$$;
