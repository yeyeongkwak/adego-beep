import type { SupabaseClient } from '@supabase/supabase-js'
import type { LatLng, RouteStop } from '@/types/route'
import { haversineKm } from '@/util/map/distance'

// A stop on one GTFS trip. stopSequence is kept so a saved ride can later
// tell which stop is next-to-last (e.g. a "get off next stop" alert).
export type TripStop = RouteStop & { stopId: string; stopSequence: number }

// Every stop of a trip, in order. Shared by /api/trip-map (vehicle map) and
// /api/journeys (the stops a saved ride passes).
export async function getTripStops(
    db: SupabaseClient,
    tripId: string
): Promise<TripStop[]> {
    const times = await db
        .from('gtfs_stop_times')
        .select('stop_id, stop_sequence')
        .eq('trip_id', tripId)
        .order('stop_sequence', { ascending: true })
    if (times.error || !times.data?.length) return []

    const stopIds = [...new Set(times.data.map((r) => r.stop_id as string))]
    const stops = await db
        .from('gtfs_stops')
        .select('stop_id, stop_name, stop_lat, stop_lon')
        .in('stop_id', stopIds)
    if (stops.error || !stops.data) return []

    const byId = new Map(stops.data.map((s) => [s.stop_id, s]))
    return times.data
        .map((t): TripStop | null => {
            const s = byId.get(t.stop_id)
            if (!s || s.stop_lat == null || s.stop_lon == null) return null
            return {
                stopId: t.stop_id,
                stopSequence: t.stop_sequence,
                name: s.stop_name ?? '',
                lat: s.stop_lat,
                lng: s.stop_lon,
            }
        })
        .filter((s): s is TripStop => s != null)
}

const nearestIndex = (stops: TripStop[], p: LatLng, from: number) => {
    let best = -1
    let bestKm = Infinity
    for (let i = from; i < stops.length; i++) {
        const km = haversineKm(stops[i], p)
        if (km < bestKm) {
            best = i
            bestKm = km
        }
    }
    return best
}

// The stops actually ridden: boarding through alighting, inclusive. Matched by
// position since Google's stops are its own; alighting is searched only after
// boarding so loop routes that pass a stop twice slice the right way. Null if
// the trip doesn't line up (fewer than two stops between).
export function rideStops(
    stops: TripStop[],
    board: LatLng,
    alight: LatLng
): TripStop[] | null {
    const from = nearestIndex(stops, board, 0)
    if (from < 0) return null
    const to = nearestIndex(stops, alight, from + 1)
    if (to < 0) return null
    return stops.slice(from, to + 1)
}
