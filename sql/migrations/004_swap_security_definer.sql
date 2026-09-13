-- Delta on top of 003. Run once against an existing DB.
-- Idempotent, safe to rerun.

-- update-gtfs.ts calls this via supabase.rpc() as the service_role.
-- TRUNCATE/INSERT only need table grants (service_role already has those),
-- but DROP INDEX/CREATE INDEX require owning the index — 
-- and the indexes were created via the SQL editor, so they're owned by postgres, not service_role. 
-- SECURITY DEFINER runs the function as its owner (postgres,
-- since we create it here) instead of as the caller, fixing that.
-- search_path is pinned as required practice for SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
