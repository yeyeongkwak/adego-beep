import type { SupabaseClient } from '@supabase/supabase-js'
import type {
    LiveArrival,
    ScheduledCall,
    StopArrival,
    MergedRow,
} from '@/types/route'

// Use the timetable, and change the time when we have a live one.

const ID_CHUNK = 200
const EARLY_SECONDS = 5 * 60

async function fetchByIds<T>(
    db: SupabaseClient,
    ids: string[],
    fetcher: (
        db: SupabaseClient,
        chunk: string[]
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
    if (ids.length === 0) return []
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
        chunks.push(ids.slice(i, i + ID_CHUNK))
    }
    const results = await Promise.all(chunks.map((c) => fetcher(db, c)))
    const rows: T[] = []
    for (const result of results) {
        if (result.error) throw new Error(result.error.message)
        rows.push(...(result.data ?? []))
    }
    return rows
}

// Match by stop visit, not by trip. A loop bus (like 404) stops at the last
// stop two times, and the feed gives both the number 999.
function pairLive(
    scheduled: ScheduledCall[],
    live: LiveArrival[]
): MergedRow[] {
    const rows: MergedRow[] = scheduled.map((call) => ({
        tripId: call.tripId,
        routeId: null,
        stopSequence: call.stopSequence,
        arrivalEpoch: call.arrivalEpoch,
        scheduledEpoch: call.arrivalEpoch,
        live: false,
    }))
    const callsByTrip = new Map<string, MergedRow[]>()
    for (const row of rows) {
        const list = callsByTrip.get(row.tripId)
        if (list) list.push(row)
        else callsByTrip.set(row.tripId, [row])
    }

    const bySequence = (a: MergedRow, b: MergedRow) =>
        (a.stopSequence ?? 0) - (b.stopSequence ?? 0)
    // Buses are late much more than early.
    const latestBefore = (calls: MergedRow[], epoch: number) =>
        calls.findLast((c) => c.scheduledEpoch! <= epoch + EARLY_SECONDS) ??
        calls[0] ??
        null

    for (const update of live) {
        const calls = (callsByTrip.get(update.tripId) ?? [])
            .filter((c) => !c.live)
            .sort(bySequence)
        const call =
            calls.length > 1 && update.visit === 'first'
                ? calls[0]
                : calls.length > 1 && update.visit === 'last'
                  ? calls[calls.length - 1]
                  : latestBefore(calls, update.arrivalEpoch)
        if (call) {
            call.arrivalEpoch = update.arrivalEpoch
            call.routeId = update.routeId
            call.live = true
        } else {
            rows.push({
                tripId: update.tripId,
                routeId: update.routeId,
                stopSequence: update.stopSequence,
                arrivalEpoch: update.arrivalEpoch,
                scheduledEpoch: null,
                live: true,
            })
        }
    }
    return rows
}

export async function mergeArrivals(
    db: SupabaseClient,
    scheduled: ScheduledCall[],
    live: LiveArrival[],
    nowEpoch: number,
    lowerEpoch: number,
    limit: number
): Promise<StopArrival[]> {
    // Keep one row per trip. On a loop, the later one is the bus finishing.
    const seen = new Set<string>()
    const merged = pairLive(scheduled, live)
        .filter((r) => r.arrivalEpoch >= lowerEpoch)
        .sort((a, b) => a.arrivalEpoch - b.arrivalEpoch)
        .filter((r) => !seen.has(r.tripId) && seen.add(r.tripId))
        .slice(0, limit)
    if (merged.length === 0) return []

    // stop_times has no route_id, so we get it from the trip. Headsign too.
    const tripIds = [...new Set(merged.map((m) => m.tripId))]
    const trips = await fetchByIds<{
        trip_id: string
        route_id: string | null
        trip_headsign: string | null
    }>(db, tripIds, (d, chunk) =>
        d
            .from('gtfs_trips')
            .select('trip_id, route_id, trip_headsign')
            .in('trip_id', chunk)
    )
    const tripById = new Map(trips.map((t) => [t.trip_id, t]))

    const routeIds = [
        ...new Set(
            merged
                .map((m) => m.routeId ?? tripById.get(m.tripId)?.route_id)
                .filter((id): id is string => Boolean(id))
        ),
    ]
    const routes = await fetchByIds<{
        route_id: string
        route_short_name: string | null
        route_long_name: string | null
        route_color: string | null
    }>(db, routeIds, (d, chunk) =>
        d
            .from('gtfs_routes')
            .select('route_id, route_short_name, route_long_name, route_color')
            .in('route_id', chunk)
    )
    const routeById = new Map(routes.map((r) => [r.route_id, r]))

    return merged.map((m) => {
        const trip = tripById.get(m.tripId)
        const routeId = m.routeId ?? trip?.route_id ?? null
        const route = routeId ? routeById.get(routeId) : null
        const rawColor = route?.route_color?.trim()
        const color = rawColor ? `#${rawColor}` : null
        return {
            route:
                route?.route_short_name ??
                route?.route_long_name ??
                routeId ??
                '?',
            destination: trip?.trip_headsign ?? '',
            minutes: Math.max(0, Math.round((m.arrivalEpoch - nowEpoch) / 60)),
            live: m.live,
            tripId: m.tripId,
            stopSequence: m.stopSequence,
            color,
            arrivalEpoch: m.arrivalEpoch,
            scheduledEpoch: m.scheduledEpoch,
            delayMin:
                m.live && m.scheduledEpoch != null
                    ? Math.round((m.arrivalEpoch - m.scheduledEpoch) / 60)
                    : null,
        }
    })
}
