import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { LatLng } from '@/types/geo'
import type { RouteStop } from '@/types/journey'
import { getBlockTripIds } from '@/lib/arrivals/block'
import { findVehicleForTrips } from '@/lib/arrivals/realtime'
import { getTripStops } from '@/lib/tripStops'

/* On-demand stop list + road-shape for a single trip.
 Called when the user taps the GPS button on a journey card — lazily fetching
 this data (rather than in /api/directions) means we only query what the user
 actually opens, not every vehicle-tracked leg in the result list.
*/

// PostgREST caps each response at 1000 rows. Long Adelaide routes (e.g. 801
// ≈1310 pts) need a second page — otherwise the city end of the shape is
// missing and the polyline sits off-screen while stop markers still show.
const SHAPE_PAGE = 1000

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

    const points: LatLng[] = []
    for (let from = 0; ; from += SHAPE_PAGE) {
        const shape = await db
            .from('gtfs_shapes')
            .select('shape_pt_lat, shape_pt_lon, shape_pt_sequence')
            .eq('shape_id', shapeId)
            .order('shape_pt_sequence', { ascending: true })
            .range(from, from + SHAPE_PAGE - 1)
        if (shape.error || !shape.data) return points

        for (const p of shape.data) {
            if (p.shape_pt_lat != null && p.shape_pt_lon != null) {
                points.push({ lat: p.shape_pt_lat, lng: p.shape_pt_lon })
            }
        }
        if (shape.data.length < SHAPE_PAGE) break
    }
    return points
}

export async function GET(request: NextRequest) {
    const tripId = request.nextUrl.searchParams.get('tripId')
    if (!tripId) {
        return NextResponse.json(
            { error: 'tripId is required' },
            { status: 400 }
        )
    }

    const db = createPublicClient()
    // Live polls only need the bus, not the stops and shape again.
    const vehicleOnly = request.nextUrl.searchParams.get('only') === 'vehicle'

    const [stops, shape, vehicle] = await Promise.all([
        vehicleOnly
            ? []
            : getTripStops(db, tripId).catch(() => [] as RouteStop[]),
        vehicleOnly ? [] : getTripShape(db, tripId).catch(() => [] as LatLng[]),
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
              timestamp: vehicle.timestamp,
          }
        : null

    return NextResponse.json({ stops, shape, vehicle: vehicleOut })
}
