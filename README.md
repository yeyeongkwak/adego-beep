# Adego Beep

Adelaide transit helper — rebuild.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth later)
- Adelaide Metro GTFS static feed
- **Yarn 4** (package manager)

## Setup

```bash
# Yarn 4 (Corepack)
corepack enable

cp .env.example .env.local
# fill SUPABASE keys

yarn install
yarn add @supabase/supabase-js adm-zip csv-parse
yarn add -D tsx @types/adm-zip

yarn dev
```

## GTFS update (local first)

1. Run `sql/gtfs_staging_setup.sql` in Supabase SQL editor (existing `gtfs_*` tables required).
2. Set env vars in `.env.local`.
3. Run:

```bash
yarn gtfs:update
# or: yarn tsx scripts/update-gtfs.ts
```

Same hash → skip. New hash → staging → swap → `gtfs_imports` row.

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Next dev server |
| `yarn build` | Production build |
| `yarn gtfs:update` | Import latest Static GTFS |

## Next steps

1. Confirm staging SQL + one successful import
2. Fix `geom` / nearby stops
3. Reduce `gtfs_stops.route_type` dependency in app
4. `rt_arrivals` retention
5. Arrival-time next departure logic
