import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getLiveArrivals } from '@/lib/arrivals/realtime'
import { adelaideNow, getScheduledCalls } from '@/lib/arrivals/schedule'
import { mergeArrivals } from '@/lib/arrivals/merge'

// Arrivals for one stop: the static timetable (every scheduled trip) merged with
// GTFS-R predictions (live times for tracked trips). See lib/arrivals/*.

const GRACE_SECONDS = 60
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

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const now = adelaideNow()
    const nowEpoch = Math.floor(Date.now() / 1000)
    const lowerEpoch = nowEpoch - GRACE_SECONDS
    const windowEndEpoch = nowEpoch + windowMinutes * 60

    try {
        const [scheduled, live] = await Promise.all([
            getScheduledCalls(db, stopId, now, lowerEpoch, windowEndEpoch),
            getLiveArrivals(stopId, lowerEpoch, windowEndEpoch),
        ])

        const arrivals = await mergeArrivals(
            db,
            scheduled,
            live.arrivals,
            nowEpoch,
            limit
        )

        return NextResponse.json({
            arrivals,
            feedTimestamp: live.feedTimestamp,
        })
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message ?? 'Failed to load arrivals' },
            { status: 500 }
        )
    }
}
