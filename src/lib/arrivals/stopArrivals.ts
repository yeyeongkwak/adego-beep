import type { SupabaseClient } from '@supabase/supabase-js'
import type { StopArrival } from '@/types/route'
import { getLiveArrivals } from './realtime'
import { adelaideNow, getScheduledCalls } from './schedule'
import { mergeArrivals } from './merge'

// Arrivals for one stop: the static timetable merged with GTFS-R predictions.
// Shared by /api/stop-arrival (stop sheet) and /api/directions (journey times).

const GRACE_SECONDS = 60

export async function getStopArrivals(
    db: SupabaseClient,
    stopId: string,
    { limit, windowMinutes }: { limit: number; windowMinutes: number }
): Promise<{ arrivals: StopArrival[]; feedTimestamp: number | null }> {
    const now = adelaideNow()
    const nowEpoch = Math.floor(Date.now() / 1000)
    const lowerEpoch = nowEpoch - GRACE_SECONDS
    const windowEndEpoch = nowEpoch + windowMinutes * 60

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
    return { arrivals, feedTimestamp: live.feedTimestamp }
}
