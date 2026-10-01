import type { SupabaseClient } from '@supabase/supabase-js'
import type {
    LiveArrival,
    ScheduledCall,
    StopArrival,
    MergedRow,
} from '@/types/route'

// Merges the scheduled timetable with realtime predictions
// The timetable is the base list, a realtime match overrides the time and marks the row live.
// Then attaches route number + headsign and sorts by arrival.

const ID_CHUNK = 200

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

export async function mergeArrivals(
    db: SupabaseClient,
    scheduled: ScheduledCall[],
    live: LiveArrival[],
    nowEpoch: number,
    limit: number
): Promise<StopArrival[]> {
    const byTrip = new Map<string, MergedRow>()

    for (const call of scheduled) {
        byTrip.set(call.tripId, {
            tripId: call.tripId,
            routeId: null,
            stopSequence: call.stopSequence,
            arrivalEpoch: call.arrivalEpoch,
            scheduledEpoch: call.arrivalEpoch,
            live: false,
        })
    }

    // Overwrite the scheduled time with the live prediction when available.
    for (const update of live) {
        const existing = byTrip.get(update.tripId)
        byTrip.set(update.tripId, {
            tripId: update.tripId,
            routeId: update.routeId ?? existing?.routeId ?? null,
            stopSequence: update.stopSequence ?? existing?.stopSequence ?? null,
            arrivalEpoch: update.arrivalEpoch,
            // Keep the timetable time so the delay can be derived.
            scheduledEpoch: existing?.scheduledEpoch ?? null,
            live: true,
        })
    }

    const merged = [...byTrip.values()]
        .sort((a, b) => a.arrivalEpoch - b.arrivalEpoch)
        .slice(0, limit)
    if (merged.length === 0) return []

    // route_id is missing on schedule-only rows (stop_times lacks it), so
    // resolve it via the trip. headsign also comes from the trip.
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
