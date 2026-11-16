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
├── scripts/                 # GTFS import, etc.
└── .github/workflows/       # CI + daily GTFS update
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
| `/api/directions`                       | Google Routes → journeys, matched to GTFS rides |
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
  (schedule + realtime) lives in `lib/arrivals/`.
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

Signed-in and signed-out favourites are **separate**; signing in does not
copy local favourites into the account.

## Related docs

- `README.md` — product features and env setup
- `docs/SCREENS.md` — per-screen features + screenshots
- `DATA.md` — Google APIs, GTFS static/realtime, daily import Action
- `AGENTS.md` — conventions for edits (placement, style, GTFS quirks)
