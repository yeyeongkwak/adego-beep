-- Stop display number (GTFS stop_code) on favourites. Was briefly stuffed into
-- address; move any existing stop rows over, then leave address for places.

ALTER TABLE public.favorite_locations ADD COLUMN IF NOT EXISTS code text;

UPDATE public.favorite_locations
SET code = address, address = NULL
WHERE place_type = 'stop'
  AND address IS NOT NULL
  AND code IS NULL;
