# Adelaide Go Beep

Adelaide public transport app. Google Routes plans the trip; Adelaide Metro
GTFS (Supabase) and GTFS-Realtime give live times.

## Features

Screen-by-screen pitch with screenshots: **[docs/SCREENS.md](./docs/SCREENS.md)**.

- **Home** — map bounds → nearby stops (code + distance), live GTFS-R
  departures, Where to? search
- **Route** — A→B, leave now / later, free-bus filter, walk + catch hints,
  live delay, lasting journey detail + vehicle on the map
- **Favourites** — places vs stops; stop codes in the list; localStorage when
  signed out, account sync after Google sign-in
- **Recent** — recent places on this device only
- **Profile** — Google sign-in / sign-out (JWT cookie, not Supabase Auth)
- **PWA** — installable (`manifest`, theme colour, safe-area tab bar)

Also: [STRUCTURE.md](./STRUCTURE.md) · [DATA.md](./DATA.md) · [AGENTS.md](./AGENTS.md)

## Stack

Next.js 16, React 19, TanStack Query, Tailwind + shadcn/ui, Yarn 4, Supabase
Postgres, Google Maps / Routes / Places.

## Setup

```bash
corepack enable
yarn install
# create .env.local with the vars below
yarn dev                     # http://localhost:3000
```

### Env

| Variable                                    | Used for                                   |
| ------------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                  | Supabase                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`      | Browser / anon queries                     |
| `SUPABASE_SECRET_KEY`                       | Favourites API, GTFS import                |
| `SUPABASE_DB_URL`                           | GTFS staging swap (direct Postgres)        |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`           | Maps in the browser                        |
| `NEXT_PUBLIC_GOOGLE_MAPS_ID`                | Map ID                                     |
| `GOOGLE_MAPS_API_KEY`                       | Places / reverse-geocode / Routes (server) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth                               |
| `SESSION_SECRET`                            | App session JWT                            |
| `NEXT_PUBLIC_SITE_URL`                      | OAuth redirect origin (prod)               |

OAuth redirect URI: `{NEXT_PUBLIC_SITE_URL}/api/auth/callback`.

### Commands

| Command                     |                                    |
| --------------------------- | ---------------------------------- |
| `yarn dev`                  | Dev server                         |
| `yarn build` / `yarn start` | Production                         |
| `yarn ci:verify`            | Lint + format check + build        |
| `yarn gtfs:update`          | Reload static GTFS into Supabase   |
| `yarn db:types`             | Regenerate `src/types/database.ts` |

GTFS SQL migrations live in `sql/migrations/` and are run by hand in the
Supabase SQL editor. GitHub Actions runs `yarn gtfs:update` daily.

- Screens + screenshots: [docs/SCREENS.md](./docs/SCREENS.md)
- Folder layout: [STRUCTURE.md](./STRUCTURE.md)
- Google APIs + GTFS / GitHub Action import: [DATA.md](./DATA.md)
