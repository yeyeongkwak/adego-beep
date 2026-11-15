-- Direct Google OAuth (our JWT) owns users. Favourites are written only by
-- our API with the secret key, so RLS policies for `authenticated` go away.
-- Idempotent. If favorite_locations still has rows pointing at auth.users
-- ids, clear those rows before the new FK or this migration will fail.

CREATE TABLE IF NOT EXISTS public.app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text,
  picture     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon/authenticated can't read or write.
-- The API uses SUPABASE_SECRET_KEY (bypasses RLS).

DROP POLICY IF EXISTS "own favorites" ON public.favorite_locations;

REVOKE ALL ON TABLE public.app_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.favorite_locations FROM authenticated;

ALTER TABLE public.favorite_locations
  DROP CONSTRAINT IF EXISTS favorite_locations_user_id_fkey;

ALTER TABLE public.favorite_locations
  ADD CONSTRAINT favorite_locations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users (id)
  ON DELETE CASCADE;
