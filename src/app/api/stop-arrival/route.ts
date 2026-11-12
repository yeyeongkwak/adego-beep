import { createPublicClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getStopArrivals } from '@/lib/arrivals/stopArrivals'

// Arrivals for one stop: the static timetable (every scheduled trip) merged with
// GTFS-R predictions (live times for tracked trips). See lib/arrivals/*.

const DEFAULT_LIMIT = 8
const DEFAULT_WINDOW_MINUTES = 90

export async function GET(request: NextRequest) {
    const stopId = request.nextUrl.searchParams.get('stopId')?.trim()
    if (!stopId) {
        return NextResponse.json(
            { error: 'stopId is required' },
            { status: 400 }
        )
    }

    const limit =
        Number(request.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT
    const windowMinutes =
        Number(request.nextUrl.searchParams.get('windowMinutes')) ||
        DEFAULT_WINDOW_MINUTES

    const db = createPublicClient()

    try {
        const { arrivals, feedTimestamp } = await getStopArrivals(db, stopId, {
            limit,
            windowMinutes,
        })
        return NextResponse.json({ arrivals, feedTimestamp })
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message ?? 'Failed to load arrivals' },
            { status: 500 }
        )
    }
}
