-- Delta on top of 001_gtfs_staging_setup.sql. Run once against an existing DB.

-- block_id chains trips run by the same physical vehicle (bus number can change mid-journey); 
-- needed to track a vehicle across a trip_id boundary.
ALTER TABLE public.gtfs_trips         ADD COLUMN IF NOT EXISTS block_id text;
ALTER TABLE public.gtfs_staging_trips ADD COLUMN IF NOT EXISTS block_id text;

-- ~2M rows across stop_times/shapes; default statement_timeout kills the swap mid-transaction, 
-- so extend it for this function's transaction only.
CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  SET LOCAL statement_timeout = '5min';

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
END;
$$;
