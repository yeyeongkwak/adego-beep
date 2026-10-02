import { createPublicClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { distanceMeters } from '@/lib/utils'
import type { Stop, StopMode } from '@/types/common'

// GTFS route_type -> our stop icon/color grouping.
const ROUTE_TYPE_MODE: Record<number, StopMode> = {
    0: 'TRAM',
    1: 'RAIL',
    2: 'RAIL',
    3: 'BUS',
}

// Bounding-box query over the map's visible rectangle. No PostGIS/spatial
// index, but .gte/.lte on lat/lon is plenty for city-block scale.
const NEARBY_LIMIT = 20

export async function GET(request: NextRequest) {
    const north = Number(request.nextUrl.searchParams.get('north'))
    const south = Number(request.nextUrl.searchParams.get('south'))
    const east = Number(request.nextUrl.searchParams.get('east'))
    const west = Number(request.nextUrl.searchParams.get('west'))
    if (
        !Number.isFinite(north) ||
        !Number.isFinite(south) ||
        !Number.isFinite(east) ||
        !Number.isFinite(west)
    ) {
        return NextResponse.json(
            { error: 'north, south, east and west are required' },
            { status: 400 }
        )
    }
    // Distances are reported relative to the view centre.
    const center = { lat: (north + south) / 2, lng: (east + west) / 2 }

    const supabase = createPublicClient()
    const { data, error } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon, route_type')
        .gte('stop_lat', south)
        .lte('stop_lat', north)
        .gte('stop_lon', west)
        .lte('stop_lon', east)
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
