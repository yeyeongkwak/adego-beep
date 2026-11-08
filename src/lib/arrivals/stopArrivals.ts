import type { SupabaseClient } from '@supabase/supabase-js'
import type { StopArrival } from '@/types/route'
import { getLiveArrivals } from './realtime'
import { adelaideNow, getScheduledCalls } from './schedule'
import { mergeArrivals } from './merge'

// Timetable + live times for one stop.

const GRACE_SECONDS = 60
// If a bus is later than this, we can't show how late it is.
const LATE_LOOKBACK_SECONDS = 60 * 60

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
        getScheduledCalls(
            db,
            stopId,
            now,
            nowEpoch - LATE_LOOKBACK_SECONDS,
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
