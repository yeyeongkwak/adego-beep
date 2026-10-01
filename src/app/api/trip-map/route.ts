import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { LatLng, RouteStop } from '@/types/route'
import { getBlockTripIds } from '@/lib/arrivals/block'
import { findVehicleForTrips } from '@/lib/arrivals/realtime'

/* On-demand stop list + road-shape for a single trip.
 Called when the user taps the GPS button on a journey card — lazily fetching
 this data (rather than in /api/directions) means we only query what the user
 actually opens, not every vehicle-tracked leg in the result list.
*/

async function getTripStops(
    db: SupabaseClient,
    tripId: string
): Promise<RouteStop[]> {
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
        .map((t) => {
            const s = byId.get(t.stop_id)
            if (!s || s.stop_lat == null || s.stop_lon == null) return null
            return { name: s.stop_name ?? '', lat: s.stop_lat, lng: s.stop_lon }
        })
        .filter((s): s is RouteStop => s != null)
}

async function getTripShape(
    db: SupabaseClient,
    tripId: string
): Promise<LatLng[]> {
    const trip = await db
        .from('gtfs_trips')
        .select('shape_id')
        .eq('trip_id', tripId)
        .maybeSingle()
    const shapeId = trip.data?.shape_id
    if (trip.error || !shapeId) return []

    const shape = await db
        .from('gtfs_shapes')
        .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
        .eq('shape_id', shapeId)
        .order('shape_pt_sequence', { ascending: true })
    if (shape.error || !shape.data) return []

    return shape.data
        .map((p) =>
            p.shape_pt_lat != null && p.shape_pt_lon != null
                ? { lat: p.shape_pt_lat, lng: p.shape_pt_lon }
                : null
        )
        .filter((p): p is LatLng => p != null)
}

export async function GET(request: NextRequest) {
    const tripId = request.nextUrl.searchParams.get('tripId')
    if (!tripId) {
        return NextResponse.json(
            { error: 'tripId is required' },
            { status: 400 }
        )
    }

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    const [stops, shape, vehicle] = await Promise.all([
        getTripStops(db, tripId).catch(() => [] as RouteStop[]),
        getTripShape(db, tripId).catch(() => [] as LatLng[]),
        getBlockTripIds(db, tripId)
            .then((tripIds) => findVehicleForTrips(tripIds))
            .catch(() => null),
    ])

    const vehicleOut = vehicle
        ? {
              lat: vehicle.lat,
              lng: vehicle.lng,
              tripId: vehicle.tripId,
              currentStopSequence: vehicle.currentStopSequence,
          }
        : null

    return NextResponse.json({ stops, shape, vehicle: vehicleOut })
}
