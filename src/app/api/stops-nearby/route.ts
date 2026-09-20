import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { distanceMeters } from '@/lib/utils'
import type { Stop, StopMode } from '@/components/home-sheet'

// GTFS route_type -> our stop icon/color grouping.
const ROUTE_TYPE_MODE: Record<number, StopMode> = {
    0: 'TRAM',
    1: 'RAIL',
    2: 'RAIL',
    3: 'BUS',
}

// ponytail: lat/lng bounding box, not a true radius — fine for "nearby" at
// city-block scale, no PostGIS/spatial index to size a real radius query.
const NEARBY_BOX_DEG = 0.02 // ~2.2km
const NEARBY_LIMIT = 20

export async function GET(request: NextRequest) {
    const lat = Number(request.nextUrl.searchParams.get('lat'))
    const lng = Number(request.nextUrl.searchParams.get('lng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json(
            { error: 'lat and lng are required' },
            { status: 400 }
        )
    }
    const center = { lat, lng }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const { data, error } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon, route_type')
        .gte('stop_lat', center.lat - NEARBY_BOX_DEG)
        .lte('stop_lat', center.lat + NEARBY_BOX_DEG)
        .gte('stop_lon', center.lng - NEARBY_BOX_DEG)
        .lte('stop_lon', center.lng + NEARBY_BOX_DEG)
    if (error || !data) {
        return NextResponse.json({ error: error?.message }, { status: 500 })
    }

    const stops: Stop[] = data
        .filter((s) => s.stop_lat != null && s.stop_lon != null)
        .map((s) => ({
            id: s.stop_id,
            name: s.stop_name ?? 'Unnamed stop',
            code: s.stop_code,
            lat: s.stop_lat,
            lng: s.stop_lon,
            mode: ROUTE_TYPE_MODE[s.route_type as number] ?? 'BUS',
            distanceM: Math.round(
                distanceMeters(center, { lat: s.stop_lat, lng: s.stop_lon })
            ),
        }))
        .sort((a, b) => a.distanceM! - b.distanceM!)
        .slice(0, NEARBY_LIMIT)

    return NextResponse.json({ stops })
}
