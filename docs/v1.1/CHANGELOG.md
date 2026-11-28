# Changelog

## v1.1 — 2026-11-26

Routes now come from our own OpenTripPlanner server, and Adelaide Metro
notices (detours, stop closures) show on each ride.

### Added

- **Self-hosted OTP routing.** OpenTripPlanner 2.9 runs on an Oracle Cloud VM
  (Always Free limits) at `https://otp.adegobeep.com`, behind Caddy for HTTPS.
  `/api/directions` uses it when `OTP_URL` is set. See [OTP.md](./OTP.md).
- **OTP graph deploy workflow** (`otp-graph.yml`). It rebuilds the transit
  graph after each GTFS update, or by hand with `force`, and deploys it to
  the VM over SSH. The street graph is a release asset (`otp-street-2.9.0`).
- **Service notices on rides.** The service_alerts feed is read and attached
  to each ride as `alerts`. See [NOTICES.md](./NOTICES.md).
    - Card: amber banner with the newest notice and `+N`.
    - Detail: the notices (tap for the text and the Metro link), "On your ride"
      and "Use instead" stops, a detour note, and a "Notice" tag on stops.
    - Map: a dashed line on a detour, ⚠ on closed stops, "See notice" on the
      board/get-off callouts, and green "Use instead" markers.
- **Detour traces (groundwork).** `collect-traces.yml` runs hourly and stores
  live positions of buses on detour routes in `vehicle_traces`, kept for 1 day.
  Migration: `sql/migrations/013_vehicle_traces.sql`. Not drawn on the map yet.

### Changed

- **Google Routes is now the fallback.** It is used when `OTP_URL` isn't set
  or OTP doesn't answer.
- **GTFS update runs hourly** (was daily). An unchanged zip is skipped by its
  hash, so most runs are just a download.
- **More space above the journey time** in the route detail header.

### Fixed

- A notice's active period comes split in two halves; they are now joined.
  Before, notices for future events (e.g. December pageants) showed today.

### Known limits

- Notices name stops in free text. A stop written without "Stop" (e.g. "F1
  Hutt St") or a temporary stop with no number can't be read or located.
- When one route has a different alternative per destination ("450 to
  Elizabeth / to Riverlea Park"), both are shown.
- A notice for some dates only ("Mondays 9, 16, 23 Nov") shows every night in
  its period.
- A journey saved before a notice started doesn't pick the notice up.
- No feed gives a detour's real path, so the map shows the usual line (dashed).
