import type { SupabaseClient } from '@supabase/supabase-js'
import type { LatLng } from '@/types/geo'
import type { RouteStop } from '@/types/journey'
import { haversineKm } from '@/util/map/distance'

// We keep stopSequence so a saved ride can find the second last stop.
export type TripStop = RouteStop & { stopId: string; stopSequence: number }

// Seconds from midnight of the service day. Can be more than 86400.
export type TripCall = TripStop & {
    arrivalSecs: number | null
    departureSecs: number | null
}

function gtfsTimeToSecs(time: string | null): number | null {
    const m = time?.match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/)
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null
}

export async function getTripCalls(
    db: SupabaseClient,
    tripId: string
): Promise<TripCall[]> {
    const times = await db
        .from('gtfs_stop_times')
        .select('stop_id, stop_sequence, arrival_time, departure_time')
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
        .map((t): TripCall | null => {
            const s = byId.get(t.stop_id)
            if (!s || s.stop_lat == null || s.stop_lon == null) return null
            return {
                stopId: t.stop_id,
                stopSequence: t.stop_sequence,
                name: s.stop_name ?? '',
                lat: s.stop_lat,
                lng: s.stop_lon,
                arrivalSecs: gtfsTimeToSecs(t.arrival_time),
                departureSecs: gtfsTimeToSecs(t.departure_time),
            }
        })
        .filter((s): s is TripCall => s != null)
}

// Same but no times. Saved journeys don't keep times.
export async function getTripStops(
    db: SupabaseClient,
    tripId: string
): Promise<TripStop[]> {
    const calls = await getTripCalls(db, tripId)
    return calls.map((c) => ({
        stopId: c.stopId,
        stopSequence: c.stopSequence,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
    }))
}

export const nearestIndex = (stops: TripStop[], p: LatLng, from: number) => {
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

// Stops from boarding to getting off. We look for the get-off stop after
// boarding, so a loop bus works too.
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
