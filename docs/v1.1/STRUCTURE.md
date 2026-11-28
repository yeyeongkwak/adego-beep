# Project structure

Where things live, and what talks to what.

```
adego-beep/
├── src/
│   ├── app/                 # Next.js App Router (pages + API)
│   ├── components/
│   │   ├── page/<screen>/   # UI owned by one screen
│   │   └── ui/              # Shared UI (sheets, rows, shadcn)
│   ├── hooks/               # Client React hooks
│   ├── lib/                 # Server-only (Supabase, GTFS, arrivals)
│   ├── types/               # Shared types only (no logic)
│   └── util/                # Plain helpers (client + server safe)
├── sql/migrations/          # Postgres migrations (run by hand)
├── scripts/                 # GTFS import, detour trace collector
├── otp/                     # OTP server config (copied to the VM)
├── docs/v1.1/               # These docs
└── .github/workflows/       # CI, GTFS update, OTP graph, traces
```

## App routes (`src/app`)

| Path                      | Role                          |
| ------------------------- | ----------------------------- |
| `(main)/home`             | Map + nearby stops sheet      |
| `(main)/route`            | A→B journey search            |
| `(main)/route/[route_id]` | One journey detail            |
| `(main)/favourite`        | Saved places / stops          |
| `(main)/profile`          | Google sign-in                |
| `api/*`                   | Backend for the screens above |

`(main)` wraps the tab shell (footer). Pages stay thin; screens live under
`components/page/...`.

### API map

| Route                                   | Does                                            |
| --------------------------------------- | ----------------------------------------------- |
| `/api/stops-nearby`                     | Stops near a lat/lng (GTFS in Supabase)         |
| `/api/stop-arrival`                     | Timetable + live departures for a stop          |
| `/api/directions`                       | OTP (or Google) → journeys, GTFS rides, notices |
| `/api/journeys`, `/api/journeys/[id]`   | Cached / refreshed journey payloads             |
| `/api/trip-map`                         | Shape + live vehicle for one trip               |
| `/api/places/*`, `/api/reverse-geocode` | Google Places / geocode (server key)            |
| `/api/favourites`                       | Account favourites (signed-in, secret key)      |
| `/api/auth/*`                           | Google OAuth + JWT session cookie               |

## Layers

```
UI (page/ + ui/)
  → hooks/          client data (TanStack Query, localStorage)
    → /api/...      Route Handlers
      → lib/        Supabase, GTFS-Realtime, Google server calls
      → util/       pure helpers shared with the client when needed
```

- **`components/page/<name>`** — one screen’s layout and behaviour.
- **`components/ui`** — reused pieces (drawer, list row, empty state, home stop
  list). Prefer these over copying markup.
- **`hooks`** — `useDirections`, `useStopArrival`, `useFavourites`,
  `useSession`, `useRecent`, geolocation, places search.
- **`lib`** — must not be imported from client components. Arrivals merge
  (schedule + realtime) lives in `lib/arrivals/`; service notices in
  `lib/arrivals/alerts.ts`.
- **`util`** — no React. Examples: `util/route` (free-fare hints, catch
  windows), `util/map/distance`, `util/oauthSession`.
- **`types`** — grouped by data (`place`, `journey`, `arrival`, `auth`,
  `database`, …). Import the file directly; no barrel `index.ts`.

## Data stores

| What                          | Where                                                    |
| ----------------------------- | -------------------------------------------------------- |
| GTFS static (stops, trips, …) | Supabase `gtfs_*` (replaced on each `yarn gtfs:update`)  |
| Live times / vehicles         | Adelaide Metro GTFS-Realtime (fetched in `lib/arrivals`) |
| Favourites (signed out)       | `localStorage`                                           |
| Favourites (signed in)        | `favorite_locations` via `/api/favourites`               |
| Recents                       | `localStorage` only                                      |
| Session                       | HTTP-only JWT cookie (`app_session`) → `app_users`       |
| Journey planner               | OTP on the Oracle VM (`OTP_URL`); Google as fallback     |
| Detour traces                 | Supabase `vehicle_traces` (1 day, written by Actions)    |

Signed-in and signed-out favourites are **separate**; signing in does not
copy local favourites into the account.

## Related docs

- `README.md` — product features and env setup
- [SCREENS.md](./SCREENS.md) — per-screen features + screenshots
- [DATA.md](./DATA.md) — planners, GTFS static/realtime, Actions
- [OTP.md](./OTP.md) — OTP server and deploy
- [NOTICES.md](./NOTICES.md) — how service notices are read
- [CHANGELOG.md](./CHANGELOG.md) — what changed in v1.1
- `AGENTS.md` — conventions for edits (placement, style, GTFS quirks)
