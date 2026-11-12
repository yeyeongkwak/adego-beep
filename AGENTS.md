# AGENTS.md

Adelaide bus app. Google Routes finds the route; Adelaide Metro GTFS (Supabase)
and GTFS-Realtime give the real times. Next.js 16, React 19, TanStack Query,
Tailwind + shadcn/ui, Yarn 4.

## Commands

- `yarn dev` — dev server on http://localhost:3000
- `npx tsc --noEmit -p .` — type check
- `yarn lint` / `yarn prettier --check .`
- `yarn ci:verify` — lint + format + build (same as CI)
- `yarn gtfs:update` — reload GTFS into Supabase (GitHub Actions runs it daily)

## Before saying a change is done

1. Type check, eslint and prettier pass on the changed files.
2. UI changes: open the page in a browser and try it.
3. Data changes: check against real data (curl the API route), not only types.

## Where code goes

- `src/util/<area>` — plain helpers (no React), e.g. `util/route`,
  `util/map/distance`. Safe on client and server.
- `src/lib` — server-side code (Supabase, GTFS, arrivals). `lib/utils.ts`
  only holds shadcn's `cn`.
- `src/hooks` — React hooks.
- `src/types/<what>` — types grouped by what the data is, not by page:
  `geo` (LatLng, MapBounds), `place` (stops, favourites, picked places),
  `journey` (route results), `arrival` (timetable + live feed), `google`
  (raw Google API shapes). Only types here; constants and functions go to
  `src/util`. Import from the file directly, no `index.ts` barrel.
- `src/components/ui` — shared components; `src/components/page/<page>` —
  components for one page.
- A helper used in two or more files goes in the shared file for its area
  and is imported from there. Search before writing a new one; don't copy
  a function into a second file.
- A helper used in one file stays in that file until a second user appears.

## Code style

- Match the code around you: naming, file layout, comment density.
- Comments only for things the code can't show (a data quirk, a limit).
  Simple English. No "what the next line does" comments.
- Prettier: 4 spaces, no semicolons, single quotes.
- Don't read refs during render (`react-hooks/refs`); use state for anything
  the UI shows.
- `useSearchParams` needs a `<Suspense>` around the page.

## Data quirks (read before touching `src/lib/arrivals` or directions)

- GTFS `stop_sequence` 999 = last stop of every trip. A bus there ends; it
  can't be boarded, so departure lists drop it (`merge.ts`).
- Loop trips (e.g. 404) visit the same stop at seq 1 and 999. The realtime
  feed calls the loop start 999 too, so we match by visit (`first`/`last`,
  worked out in `realtime.ts`), not by the feed's number.
- The feed drops stops a bus has passed, and says "early" before a bus starts.
- Google gives no GTFS trip id. `/api/directions` matches rides by stop name,
  distance, time and headsign. Expect gaps.
- The app uses the publishable key (`anon` role, 3 s statement timeout) on a
  small Supabase instance. Keep queries indexed and don't fan out too many.

## Database

- Migrations live in `sql/migrations/NNN_*.sql` and are run by hand in the
  Supabase SQL editor. Run new ones before deploying code that needs them.
- `gtfs_*` tables are replaced on each GTFS update; never store user data there.

## Favourites and auth

- Favourites and recents are in localStorage (`src/util/localStore.ts`).
  The hooks are built so a Supabase Auth branch (`favorite_locations` table)
  can be added later without changing the UI.

## Git

- Conventional commits: `feat(scope): ...`, `fix(...)`, `perf(...)`.
- Never commit `.env*` or print secret values.
