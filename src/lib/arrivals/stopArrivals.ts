import type { SupabaseClient } from '@supabase/supabase-js'
import type { StopArrival } from '@/types/arrival'
import { getLiveArrivals } from './realtime'
import { adelaideNow, getScheduledCalls } from './schedule'
import { mergeArrivals } from './merge'

// Timetable + live times for one stop.

const GRACE_SECONDS = 60
// If a bus is later than this, we can't show how late it is.
const LATE_LOOKBACK_SECONDS = 60 * 60

// fromEpoch: start of the list (default now). Directions uses it for trips
// planned later.
export async function getStopArrivals(
    db: SupabaseClient,
    stopId: string,
    {
        limit,
        windowMinutes,
        fromEpoch,
    }: { limit: number; windowMinutes: number; fromEpoch?: number }
): Promise<{ arrivals: StopArrival[]; feedTimestamp: number | null }> {
    const nowEpoch = Math.floor(Date.now() / 1000)
    const startEpoch = fromEpoch ?? nowEpoch
    const lowerEpoch = startEpoch - GRACE_SECONDS
    const windowEndEpoch = startEpoch + windowMinutes * 60

    const [scheduled, live] = await Promise.all([
        getScheduledCalls(
            db,
            stopId,
            adelaideNow(startEpoch * 1000),
            startEpoch - LATE_LOOKBACK_SECONDS,
            windowEndEpoch
        ),
        getLiveArrivals(stopId, lowerEpoch, windowEndEpoch),
    ])

    const arrivals = await mergeArrivals(
        db,
        scheduled,
        live.arrivals,
        live.notComing,
        nowEpoch,
        lowerEpoch,
        limit
    )
    return { arrivals, feedTimestamp: live.feedTimestamp }
}
