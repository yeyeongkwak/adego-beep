import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduledCall } from '@/types/route'

// Scheduled calls at a stop from the static GTFS tables, resolved to absolute
// epochs. Handles the GTFS service-day model: times run past 24:00:00 and a
// call can belong to today's service day or yesterday's after-midnight tail.

const TZ = 'Australia/Adelaide'

const WEEKDAY_COLUMNS = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
] as const
type WeekdayColumn = (typeof WEEKDAY_COLUMNS)[number]
type CalendarRow = { service_id: string } & Record<
    WeekdayColumn,
    boolean | null
>

export type AdelaideNow = {
    date: string
    midnightEpoch: number
}

// Adelaide wall-clock date + the epoch of local midnight. The GTFS service day
// is local, so this is independent of the server's own timezone.
export function adelaideNow(): AdelaideNow {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now)
    const field = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'

    const seconds =
        Number(field('hour')) * 3600 +
        Number(field('minute')) * 60 +
        Number(field('second'))
    const nowEpoch = Math.floor(now.getTime() / 1000)
    return {
        date: `${field('year')}-${field('month')}-${field('day')}`,
        midnightEpoch: nowEpoch - seconds,
    }
}

function shiftDate(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

function weekdayColumn(date: string): WeekdayColumn {
    return WEEKDAY_COLUMNS[new Date(`${date}T00:00:00Z`).getUTCDay()]
}

// service_ids running on a date: weekly calendar pattern, then calendar_dates
// exceptions (exception_type 1 adds service, 2 removes it).
async function activeServiceIds(
    db: SupabaseClient,
    date: string
): Promise<Set<string>> {
    const [calendar, exceptions] = await Promise.all([
        db
            .from('gtfs_calendar')
            .select(
                'service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday'
            )
            .lte('start_date', date)
            .gte('end_date', date),
        db
            .from('gtfs_calendar_dates')
            .select('service_id, exception_type')
            .eq('date', date),
    ])
    if (calendar.error) throw new Error(calendar.error.message)
    if (exceptions.error) throw new Error(exceptions.error.message)

    const column = weekdayColumn(date)
    const active = new Set<string>()
    for (const row of (calendar.data ?? []) as CalendarRow[]) {
        if (row[column]) active.add(row.service_id)
    }
    for (const row of exceptions.data ?? []) {
        if (row.exception_type === 1) active.add(row.service_id)
        if (row.exception_type === 2) active.delete(row.service_id)
    }
    return active
}

// Row shape returned by the get_scheduled_calls RPC.
type ScheduledCallRow = {
    trip_id: string
    stop_sequence: number | null
    arrival_epoch: number
}

export async function getScheduledCalls(
    db: SupabaseClient,
    stopId: string,
    now: AdelaideNow,
    lowerEpoch: number,
    windowEndEpoch: number
): Promise<ScheduledCall[]> {
    // Which services run today vs. yesterday's after-midnight tail. This stays
    // in the app so the calendar-pattern + calendar_dates exception rules and
    // the timezone-sensitive date maths live in one readable place.
    const [servicesToday, servicesYesterday] = await Promise.all([
        activeServiceIds(db, now.date),
        activeServiceIds(db, shiftDate(now.date, -1)),
    ])

    // The DB does the heavy lifting: join stop_times -> trips, filter to those
    // service ids, resolve HH:MM:SS to an absolute epoch for both service days,
    // and clip to the window. Only the rows we actually need come back.
    const { data, error } = await db.rpc('get_scheduled_calls', {
        p_stop_id: stopId,
        p_service_ids_today: [...servicesToday],
        p_service_ids_yest: [...servicesYesterday],
        p_midnight_epoch: now.midnightEpoch,
        p_lower_epoch: lowerEpoch,
        p_window_end_epoch: windowEndEpoch,
    })
    if (error) throw new Error(error.message)

    return ((data ?? []) as ScheduledCallRow[]).map((row) => ({
        tripId: row.trip_id,
        stopSequence: row.stop_sequence,
        arrivalEpoch: row.arrival_epoch,
    }))
}
