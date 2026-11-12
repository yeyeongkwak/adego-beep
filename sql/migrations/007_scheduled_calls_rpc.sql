CREATE OR REPLACE FUNCTION public.get_scheduled_calls(
  p_stop_id            text,
  p_service_ids_today  text[],
  p_service_ids_yest   text[],
  p_midnight_epoch     bigint,
  p_lower_epoch        bigint,
  p_window_end_epoch   bigint
)
RETURNS TABLE (
  trip_id        text,
  stop_sequence  integer,
  arrival_epoch  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH calls AS (
    SELECT
      st.trip_id,
      st.stop_sequence,
      t.service_id,
      -- COALESCE(departure, arrival): matches the app's preference for
      -- departure_time, falling back to arrival_time.
      -- Split "HH:MM:SS" (HH may be >= 24) into seconds since midnight.
      (
        split_part(COALESCE(st.departure_time, st.arrival_time), ':', 1)::int * 3600
      + split_part(COALESCE(st.departure_time, st.arrival_time), ':', 2)::int * 60
      + split_part(COALESCE(st.departure_time, st.arrival_time), ':', 3)::int
      ) AS secs
    FROM public.gtfs_stop_times st
    JOIN public.gtfs_trips t ON t.trip_id = st.trip_id
    WHERE st.stop_id = p_stop_id
      AND COALESCE(st.departure_time, st.arrival_time) ~ '^\d{1,3}:[0-5]\d:[0-5]\d$'
  ),
  resolved AS (
    SELECT trip_id, stop_sequence, (p_midnight_epoch + secs) AS arrival_epoch
    FROM calls
    WHERE service_id = ANY (p_service_ids_today)

    UNION ALL

    SELECT trip_id, stop_sequence, (p_midnight_epoch - 86400 + secs) AS arrival_epoch
    FROM calls
    WHERE service_id = ANY (p_service_ids_yest)
  )
  SELECT trip_id, stop_sequence, arrival_epoch
  FROM resolved
  WHERE arrival_epoch >= p_lower_epoch
    AND arrival_epoch <= p_window_end_epoch
  ORDER BY arrival_epoch;
$$;

GRANT EXECUTE ON FUNCTION public.get_scheduled_calls(
  text, text[], text[], bigint, bigint, bigint
) TO anon, authenticated;
