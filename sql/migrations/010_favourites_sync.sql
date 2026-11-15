-- Favourites for signed-in users (src/hooks/useFavourites.ts). The table and
-- its "own favorites" RLS policy come from app_tables_setup.sql. Idempotent.

-- Stop mode (BUS/TRAM/RAIL) for the list icon. Null for places.
ALTER TABLE public.favorite_locations ADD COLUMN IF NOT EXISTS mode text;

-- One row per place per user, so a double tap or the sign-in upload of
-- local favourites can't add the same place twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_favorite_locations_user_place
  ON public.favorite_locations (user_id, place_type, place_id);

GRANT SELECT, INSERT, DELETE ON public.favorite_locations TO authenticated;
