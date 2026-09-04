-- Run once in Supabase SQL editor before using scripts/update-gtfs.ts

CREATE TABLE IF NOT EXISTS public.gtfs_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  file_hash text NOT NULL UNIQUE,
  feed_version text,
  status text NOT NULL DEFAULT 'loading', -- loading | success | failed
  row_counts jsonb,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.gtfs_routes_staging (LIKE public.gtfs_routes INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_stops_staging (LIKE public.gtfs_stops INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_trips_staging (LIKE public.gtfs_trips INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_stop_times_staging (LIKE public.gtfs_stop_times INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_calendar_staging (LIKE public.gtfs_calendar INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_calendar_dates_staging (LIKE public.gtfs_calendar_dates INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_shapes_staging (LIKE public.gtfs_shapes INCLUDING DEFAULTS);

-- Drop PK/FK issues on staging if LIKE copied constraints poorly; recreate simple structure if needed.

CREATE OR REPLACE FUNCTION public.truncate_gtfs_staging()
RETURNS void
LANGUAGE sql
AS $$
  TRUNCATE
    gtfs_stop_times_staging,
    gtfs_trips_staging,
    gtfs_shapes_staging,
    gtfs_calendar_dates_staging,
    gtfs_calendar_staging,
    gtfs_stops_staging,
    gtfs_routes_staging;
$$;

CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE
    gtfs_stop_times,
    gtfs_trips,
    gtfs_shapes,
    gtfs_calendar_dates,
    gtfs_calendar,
    gtfs_stops,
    gtfs_routes
  CASCADE;

  INSERT INTO gtfs_routes SELECT * FROM gtfs_routes_staging;
  INSERT INTO gtfs_stops SELECT * FROM gtfs_stops_staging;
  INSERT INTO gtfs_calendar SELECT * FROM gtfs_calendar_staging;
  INSERT INTO gtfs_calendar_dates SELECT * FROM gtfs_calendar_dates_staging;
  INSERT INTO gtfs_trips SELECT * FROM gtfs_trips_staging;
  INSERT INTO gtfs_stop_times SELECT * FROM gtfs_stop_times_staging;
  INSERT INTO gtfs_shapes SELECT * FROM gtfs_shapes_staging;
END;
$$;

-- Optional: rebuild stop geometries after swap (requires PostGIS)
CREATE OR REPLACE FUNCTION public.refresh_gtfs_stops_geom()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE gtfs_stops
  SET geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
  WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL;
$$;
