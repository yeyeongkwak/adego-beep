# Data sources

How the app gets maps, routes, real bus times and service notices (v1.1).

## Big picture

```
┌─────────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│ Google APIs     │  │ OTP (Oracle  │  │ Adelaide Metro           │
│ Maps / Places / │  │ VM) journeys │  │ Static GTFS zip          │
│ Routes fallback │  │              │  │ GTFS-Realtime feeds      │
└────────┬────────┘  └──────┬───────┘  └────────────┬─────────────┘
         │                  │      GitHub Actions hourly
         │                  │◀──── otp-graph.yml   │ yarn gtfs:update
         │                  │                      ▼
         ▼                  ▼        ┌──────────────────────────┐
┌──────────────────────────────┐     │ Supabase Postgres        │
│ Next.js /api (+ browser Maps)│────▶│ gtfs_*, vehicle_traces   │
└──────────────────────────────┘     └──────────────────────────┘
```

- **OTP** (our server, see [OTP.md](./OTP.md)) suggests journeys. **Google
  Routes** is the fallback when OTP isn't set or doesn't answer.
- **Google** still finds places and draws the map.
- **Static GTFS** in Supabase is the timetable + stop graph we own. OTP is
  built from the same zip.
- **GTFS-Realtime** is fetched live by the server (not stored long-term) and
  merged onto the timetable for departures and vehicle positions. Service
  alerts become ride notices ([NOTICES.md](./NOTICES.md)).

---

## Google APIs

| API                       | Key                                                              | Used for                         |
| ------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| Maps JavaScript           | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAPS_ID` | Home / route maps in the browser |
| Places Autocomplete (New) | `GOOGLE_MAPS_API_KEY` (server)                                   | `/api/places/autocomplete`       |
| Places Details            | same                                                             | `/api/places/details`            |
| Geocoding                 | same                                                             | `/api/reverse-geocode`           |
| Routes `computeRoutes`    | same                                                             | `/api/directions` (fallback)     |

Browser key stays public (HTTP-referrer restricted). Server key never goes to
the client; Places and Routes are proxied through Route Handlers.

### Directions flow

1. Client calls `/api/directions` with origin, destination, optional depart/arrive time.
2. Server asks **OTP** (`OTP_URL`, GraphQL `plan`, up to 5 itineraries in 6 h).
   If `OTP_URL` isn't set or OTP fails, it asks **Google Routes** instead.
3. For each ride, we match a GTFS trip/stop using stop name, distance, time
   window, and headsign (`src/app/api/directions/route.ts`). OTP gives GTFS
   trip ids, so it matches better than Google.
4. Matched rides get **our** timetable / live times from `lib/arrivals`. Unmatched
   rides keep the planner's times.
5. Each ride gets the Adelaide Metro notices that touch it (`alerts`).

Maps on the detail screen also use GTFS `shapes` + realtime vehicle positions
via `/api/trip-map`. A ride on a detour is drawn dashed, since no feed gives
the detour's path.

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

| Trigger             |                                                   |
| ------------------- | ------------------------------------------------- |
| Cron `30 * * * *`   | Hourly (v1.1; was daily). Same zip hash → skipped |
| `workflow_dispatch` | Manual run                                        |

Job (Production environment):

1. Checkout → Corepack → Node 24 → `yarn install --immutable`
2. `yarn gtfs:update` with secrets:
    - `SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`
    - `SUPABASE_SECRET_KEY`
    - `SUPABASE_DB_URL`
3. Discord notifications (webhooks below)

Local run needs the same three env vars in `.env.local`.

After a successful run, `otp-graph.yml` rebuilds the OTP graph so OTP trip ids
match Supabase ([OTP.md](./OTP.md)).

### Detour traces

`.github/workflows/collect-traces.yml` (hourly) runs `yarn traces:collect`
(`scripts/collect-traces.ts`) for ~55 min. Every 30 s it saves live positions
of buses on routes with a detour notice into `vehicle_traces`, kept for 1 day
(skips moves under 30 m). Groundwork for drawing real detour paths; the map
doesn't read it yet. Needs `sql/migrations/013_vehicle_traces.sql`.

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

| Feed              | Default URL                    | Used for                                |
| ----------------- | ------------------------------ | --------------------------------------- |
| Trip updates      | `…/realtime/trip_updates`      | Delay / cancel / skip per stop          |
| Vehicle positions | `…/realtime/vehicle_positions` | Bus pin on the map, traces              |
| Service alerts    | `…/realtime/service_alerts`    | Ride notices (`lib/arrivals/alerts.ts`) |

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

| Feature                  | Google                  | Static GTFS   | Realtime                             |
| ------------------------ | ----------------------- | ------------- | ------------------------------------ |
| Map tiles / camera       | Maps JS                 | —             | —                                    |
| Nearby stops             | —                       | `gtfs_stops`  | —                                    |
| Stop departure list      | —                       | timetable     | trip updates                         |
| Place search             | Places                  | —             | —                                    |
| A→B options              | Routes (fallback) + OTP | match + times | trip updates                         |
| Ride notices             | —                       | stop lookup   | service alerts                       |
| Ride polyline / live bus | —                       | `gtfs_shapes` | vehicle positions                    |
| Detour traces            | —                       | —             | vehicle positions → `vehicle_traces` |
