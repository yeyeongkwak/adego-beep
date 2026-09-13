-- GTFS pipeline setup. Run once before using scripts/update-gtfs.ts.
-- Everything here is idempotent (IF NOT EXISTS / CREATE OR REPLACE), safe to rerun.

CREATE TABLE IF NOT EXISTS public.gtfs_routes (
  route_id          text PRIMARY KEY,
  agency_id         text,
  route_short_name  text,
  route_long_name   text,
  route_type        integer,
  route_color       text
);

CREATE TABLE IF NOT EXISTS public.gtfs_stops (
  stop_id     text PRIMARY KEY,
  stop_code   text,
  stop_name   text,
  stop_lat    double precision,
  stop_lon    double precision,
  route_type  integer
);

CREATE TABLE IF NOT EXISTS public.gtfs_calendar (
  service_id  text PRIMARY KEY,
  monday      boolean,
  tuesday     boolean,
  wednesday   boolean,
  thursday    boolean,
  friday      boolean,
  saturday    boolean,
  sunday      boolean,
  start_date  date,
  end_date    date
);

CREATE TABLE IF NOT EXISTS public.gtfs_calendar_dates (
  service_id      text,
  date            date,
  exception_type  integer
);

CREATE TABLE IF NOT EXISTS public.gtfs_trips (
  trip_id        text PRIMARY KEY,
  route_id       text,
  service_id     text,
  trip_headsign  text,
  direction_id   integer,
  shape_id       text
);

-- arrival/departure_time can go past 24:00:00 for after-midnight trips, so text not time.
CREATE TABLE IF NOT EXISTS public.gtfs_stop_times (
  trip_id         text,
  stop_id         text,
  arrival_time    text,
  departure_time  text,
  stop_sequence   integer
);

CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
  shape_id           text,
  shape_pt_sequence  integer,
  shape_pt_lat       double precision,
  shape_pt_lon       double precision
);

CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip_id ON public.gtfs_stop_times (trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop_id ON public.gtfs_stop_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route_id     ON public.gtfs_trips (route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_service_id   ON public.gtfs_trips (service_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_calendar_dates_svc ON public.gtfs_calendar_dates (service_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_shape_id    ON public.gtfs_shapes (shape_id);

-- Staging tables mirror the above (no PK, so bulk insert never trips a constraint).
-- update-gtfs.ts loads into these, then swap_gtfs_from_staging() cuts over atomically.
CREATE TABLE IF NOT EXISTS public.gtfs_staging_routes          (LIKE public.gtfs_routes          INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_stops           (LIKE public.gtfs_stops           INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_trips           (LIKE public.gtfs_trips           INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_stop_times      (LIKE public.gtfs_stop_times      INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_calendar        (LIKE public.gtfs_calendar        INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_calendar_dates  (LIKE public.gtfs_calendar_dates  INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.gtfs_staging_shapes          (LIKE public.gtfs_shapes          INCLUDING DEFAULTS);

CREATE TABLE IF NOT EXISTS public.gtfs_imports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downloaded_at  timestamptz NOT NULL DEFAULT now(),
  file_hash      text NOT NULL UNIQUE,
  feed_version   text,
  status         text NOT NULL DEFAULT 'loading',  -- loading | success | failed
  row_counts     jsonb,
  error_message  text
);

-- Singleton row (id = 1) that update-gtfs.ts updates as it runs.
CREATE TABLE IF NOT EXISTS public.gtfs_update_status (
  id             integer PRIMARY KEY DEFAULT 1,
  status         text NOT NULL DEFAULT 'idle',
                 -- idle | updating | success | failed | partial_failed | db_error
  last_update    timestamptz,
  next_scheduled timestamptz,
  error_message  text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  completed_at   timestamptz
);

INSERT INTO public.gtfs_update_status (id, status)
VALUES (1, 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.truncate_gtfs_staging()
RETURNS void
LANGUAGE sql
AS $$
  TRUNCATE
    public.gtfs_staging_stop_times,
    public.gtfs_staging_trips,
    public.gtfs_staging_shapes,
    public.gtfs_staging_calendar_dates,
    public.gtfs_staging_calendar,
    public.gtfs_staging_stops,
    public.gtfs_staging_routes;
$$;

CREATE OR REPLACE FUNCTION public.swap_gtfs_from_staging()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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
