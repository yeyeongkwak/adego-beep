-- Delta on top of 008. Run once against an existing DB, then rerun
-- `yarn gtfs:update` to fill the new columns. Idempotent, safe to rerun.
--
-- stops.txt mixes boarding platforms (location_type 0/empty) with parent
-- stations (1) that have no stop_times. Without this column a parent station
-- named exactly like Google's stop ("Rundle Mall") wins the match and the
-- ride gets no GTFS times.
--
-- swap_gtfs_from_staging() copies with SELECT *, so both tables must gain
-- the columns in the same order.
ALTER TABLE public.gtfs_stops
  ADD COLUMN IF NOT EXISTS location_type  integer,
  ADD COLUMN IF NOT EXISTS parent_station text;

ALTER TABLE public.gtfs_staging_stops
  ADD COLUMN IF NOT EXISTS location_type  integer,
  ADD COLUMN IF NOT EXISTS parent_station text;
