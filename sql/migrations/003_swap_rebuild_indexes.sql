-- Delta on top of 002. Run once against an existing DB.
-- Idempotent, safe to rerun.

-- Even at 5min, the swap was still timing out: stop_times/shapes together
-- insert ~1.7M rows, and their indexes were being maintained row-by-row
-- during that INSERT. Dropping the indexes before the bulk load and
-- rebuilding them after (bulk build, not incremental) is the standard fix.
CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  SET LOCAL statement_timeout = '5min';

  DROP INDEX IF EXISTS public.idx_gtfs_stop_times_trip_id;
  DROP INDEX IF EXISTS public.idx_gtfs_stop_times_stop_id;
  DROP INDEX IF EXISTS public.idx_gtfs_shapes_shape_id;

  TRUNCATE
    public.gtfs_stop_times,
    public.gtfs_trips,
    public.gtfs_shapes,
    public.gtfs_calendar_dates,
    public.gtfs_calendar,
    public.gtfs_stops,
    public.gtfs_routes
  CASCADE;

  INSERT INTO public.gtfs_routes          SELECT * FROM public.gtfs_staging_routes;
  INSERT INTO public.gtfs_stops           SELECT * FROM public.gtfs_staging_stops;
  INSERT INTO public.gtfs_calendar        SELECT * FROM public.gtfs_staging_calendar;
  INSERT INTO public.gtfs_calendar_dates  SELECT * FROM public.gtfs_staging_calendar_dates;
  INSERT INTO public.gtfs_trips           SELECT * FROM public.gtfs_staging_trips;
  INSERT INTO public.gtfs_stop_times      SELECT * FROM public.gtfs_staging_stop_times;
  INSERT INTO public.gtfs_shapes          SELECT * FROM public.gtfs_staging_shapes;

  CREATE INDEX idx_gtfs_stop_times_trip_id ON public.gtfs_stop_times (trip_id);
  CREATE INDEX idx_gtfs_stop_times_stop_id ON public.gtfs_stop_times (stop_id);
  CREATE INDEX idx_gtfs_shapes_shape_id    ON public.gtfs_shapes (shape_id);
END;
$$;
