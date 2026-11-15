# Google APIs & GTFS data

How the app gets maps, routes, and real bus times.

## Big picture

```
┌─────────────────┐     ┌──────────────────────────┐
│ Google APIs     │     │ Adelaide Metro           │
│ Maps / Places / │     │ Static GTFS zip          │
│ Routes          │     │ GTFS-Realtime feeds      │
└────────┬────────┘     └────────────┬─────────────┘
         │                           │
         │                    GitHub Action daily
         │                    yarn gtfs:update
         │                           │
         ▼                           ▼
┌─────────────────┐     ┌──────────────────────────┐
│ Next.js /api    │────▶│ Supabase Postgres        │
│ (+ browser Maps)│     │ gtfs_* tables            │
└─────────────────┘     └──────────────────────────┘
```

- **Google** finds places and suggests journeys (and draws the map).
- **Static GTFS** in Supabase is the timetable + stop graph we own.
- **GTFS-Realtime** is fetched live by the server (not stored long-term) and
  merged onto the timetable for departures and vehicle positions.

---

## Google APIs

| API                       | Key                                                              | Used for                         |
| ------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| Maps JavaScript           | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAPS_ID` | Home / route maps in the browser |
| Places Autocomplete (New) | `GOOGLE_MAPS_API_KEY` (server)                                   | `/api/places/autocomplete`       |
| Places Details            | same                                                             | `/api/places/details`            |
| Geocoding                 | same                                                             | `/api/reverse-geocode`           |
| Routes `computeRoutes`    | same                                                             | `/api/directions`                |

Browser key stays public (HTTP-referrer restricted). Server key never goes to
the client; Places and Routes are proxied through Route Handlers.

### Directions flow

1. Client calls `/api/directions` with origin, destination, optional depart/arrive time.
2. Server calls Google Routes (`transit` steps + polylines).
3. For each transit ride Google returns, we try to match a GTFS trip/stop using
   stop name, distance, time window, and headsign (`src/app/api/directions/route.ts`).
4. Matched rides get **our** timetable / live times from `lib/arrivals`. Unmatched
   rides keep Google’s times (gaps are expected — Google has no GTFS trip id).

Maps on the detail screen also use GTFS `shapes` + realtime vehicle positions
via `/api/trip-map`.

---

## Static GTFS → Supabase

Source zip (default):

`https://gtfs.adelaidemetro.com.au/v1/static/latest/google_transit.zip`

Script: `scripts/update-gtfs.ts` (`yarn gtfs:update`).

### Pipeline

1. **Download** the zip; SHA-256 the bytes.
2. **Skip** if `gtfs_imports` already has that hash with `status = success`
   (most days: no Discord “success” noise — Action sets `skipped=true`).
3. **Truncate staging** — `truncate_gtfs_staging()`.
4. **Parse CSV** from the zip into staging tables:
    - `gtfs_staging_routes`
    - `gtfs_staging_stops`
    - `gtfs_staging_calendar` / `gtfs_staging_calendar_dates`
    - `gtfs_staging_trips`
    - `gtfs_staging_stop_times`
    - `gtfs_staging_shapes`
5. **Sanity check** — abort if stops/trips counts look too low (bad download).
6. **Swap** — `SELECT public.swap_gtfs_from_staging()` over a **direct**
   Postgres connection (`SUPABASE_DB_URL`). The swap can run longer than the
   Data API timeout, so it cannot go through Supabase JS alone.
7. Mark `gtfs_imports` success, clear staging again.

Live app tables are `gtfs_*` (not `gtfs_staging_*`). Those production tables
are **replaced** on each successful update — never store user data there.

Schema / RPCs come from `sql/migrations/` (applied by hand in the Supabase
SQL editor before the script relies on them).

### GitHub Action

Workflow: `.github/workflows/update-gtfs.yml`

| Trigger             |                 |
| ------------------- | --------------- |
| Cron `30 17 * * *`  | ~3–4am Adelaide |
| `workflow_dispatch` | Manual run      |

Job (Production environment):

1. Checkout → Corepack → Node 24 → `yarn install --immutable`
2. `yarn gtfs:update` with secrets:
    - `SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`
    - `SUPABASE_SECRET_KEY`
    - `SUPABASE_DB_URL`
3. Discord notifications (webhooks below)

Local run needs the same three env vars in `.env.local`.

### Discord notifications

Workflow: `.github/workflows/update-gtfs.yml`. Webhooks are repo secrets on the
**Production** environment.

| When                                         | Secret                   | Message                        |
| -------------------------------------------- | ------------------------ | ------------------------------ |
| Checkout / Node / `yarn install` fails       | `DISCORD_BUILD_WEBHOOK`  | Build failed (before GTFS ran) |
| `yarn gtfs:update` fails                     | `DISCORD_SCRIPT_WEBHOOK` | GTFS update failed             |
| Update succeeds **and** the zip hash was new | `DISCORD_SCRIPT_WEBHOOK` | GTFS update successful         |

Same-hash skips set `skipped=true` on the Action output, so Discord does **not**
get a success ping on quiet days. Embeds link to the GitHub Actions run.

CI (`.github/workflows/ci.yml`) does not post to Discord.

---

## GTFS-Realtime (live)

Fetched on demand in `src/lib/arrivals/realtime.ts` (short in-memory cache):

| Feed              | Default URL                    | Used for                       |
| ----------------- | ------------------------------ | ------------------------------ |
| Trip updates      | `…/realtime/trip_updates`      | Delay / cancel / skip per stop |
| Vehicle positions | `…/realtime/vehicle_positions` | Bus pin on the map             |

Overrides: `GTFS_RT_TRIP_UPDATES_URL`, `GTFS_RT_VEHICLE_POSITIONS_URL`.

### Stop arrivals merge

`getStopArrivals` (`lib/arrivals/stopArrivals.ts`):

1. **Schedule** from Supabase `gtfs_*` for the active service day
2. **Live** from the trip-updates feed
3. **Merge** (`merge.ts`) — prefer live when matched; drop ended trips
   (`stop_sequence` 999 quirks documented in `AGENTS.md`)

Used by `/api/stop-arrival` (home sheet) and by directions matching.

---

## Who reads what

| Feature                  | Google  | Static GTFS   | Realtime          |
| ------------------------ | ------- | ------------- | ----------------- |
| Map tiles / camera       | Maps JS | —             | —                 |
| Nearby stops             | —       | `gtfs_stops`  | —                 |
| Stop departure list      | —       | timetable     | trip updates      |
| Place search             | Places  | —             | —                 |
| A→B options              | Routes  | match + times | trip updates      |
| Ride polyline / live bus | —       | `gtfs_shapes` | vehicle positions |
