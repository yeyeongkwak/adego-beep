# Service notices

Adelaide Metro's "service disruptions" (detours, stop closures) come from the
GTFS-Realtime `service_alerts` feed. Code: `src/lib/arrivals/alerts.ts`.

## What the feed gives

- Every alert has cause/effect `UNKNOWN`.
- It points at **routes only** (`route_id` = short name, e.g. `98C`), never
  at stops.
- The description is HTML, often with tables.
- The active period comes **split in two**: `{start, no end}` and
  `{no start, end}`.
- Daily hours ("From 7:00pm to 4:00am") are only in the text.
- No detour path. TripModifications aren't in the feed either.

So everything below is read from the text.

## Flow

1. Fetch and decode the feed (5-minute cache, shared by in-flight requests).
   If it fails, rides get no notices; routing still works.
2. For each alert, work out:
    - when it's on: the joined period, plus the daily window from the text
    - the closed stops, and the alternatives for each
    - whether it's a detour (`Detour` in the title)
3. `/api/directions` passes each ride's stops (board → get off, from GTFS) and
   gets back the alerts for that ride: `alerts: ServiceAlert[]` on `BusLeg`.

## Reading stops

A stop is matched by **number + first word of the street**, e.g. `f1|hutt`.
Numbers repeat across roads, and the text spells streets loosely ("Street",
"OConnell").

| Source     | Closed                                        | Alternative                                      |
| ---------- | --------------------------------------------- | ------------------------------------------------ |
| HTML table | "Closed stop" column                          | "Alternative stop" column, same row (rowspan ok) |
| Sentences  | Before "advised / use / go to / alternative"  | After it                                         |
| Inline     | "Stop 41A Kesters Rd, go to Stop 41" → closed | the stop after "go to"                           |

If the same stop is both, closed wins.

Per route:

- A heading above a table ("98A – 99A - Anticlockwise Loop") limits its rows
  to those routes.
- Routes earlier in the sentence ("98A (Anticlockwise) - Stop 6 …", "Routes -
  98C, 99C go to …") limit the alternatives after them.
- "All other passengers …" means the routes not named before.

Per side: "Stop 5 O'Connell St - **West side**" picks that side. If no side is
given, prefer the same side as the closed stop, then the nearest stop. Drop
any alternative over 1.5 km from the closed stop.

## What shows

| Case                                          | Shown                                       |
| --------------------------------------------- | ------------------------------------------- |
| Notice names no stops we can read             | The notice (we can't tell if it applies)    |
| Notice closes a stop on the ride              | The notice + ⚠ on that stop                 |
| Closed stop is where you **board or get off** | + "Use instead" stops                       |
| Closed stop the bus only **passes**           | No alternative (it changes nothing for you) |
| Notice closes stops, none on the ride         | Hidden                                      |
| Detour notice on the ride                     | Ride line drawn dashed                      |

## Limits

- A stop written without "Stop" ("go to either F1 Hutt St") isn't read.
- Temporary stops with no number ("Temporary stop on Ridge Rd") can't be
  located.
- Alternatives that differ by destination within one route are both shown.
- "On these dates only" isn't read; the notice shows every day in its period.
- Saved journeys keep the notices they had when saved.

If these show up often, an LLM pass in the hourly GTFS job could extract the
same fields into a table, with these rules as the fallback.
