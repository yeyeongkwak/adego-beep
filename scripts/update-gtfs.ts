import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'
import { bulkInsert } from '@/util'

const GTFS_URL =
    process.env.GTFS_URL ??
    'https://gtfs.adelaidemetro.com.au/v1/static/latest/google_transit.zip'

function sha256(buf: Buffer) {
    return createHash('sha256').update(buf).digest('hex')
}

// GTFS calendar date 20260801 → 2026-08-01
export function formatGtfsDate(yyyymmdd: string) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

export function emptyToNull(v: string | undefined | null) {
    if (v == null || String(v).trim() === '') return null
    return v
}

async function ignoreErrors(
    query: PromiseLike<{ error: unknown }>,
    note: string
) {
    try {
        const { error } = await query
        if (error) console.error(note, error)
    } catch (e) {
        console.error(`Error occurred during ${note}:`, e)
    }
}

async function main() {
    const startTime = new Date().toISOString()
    console.log(`[gtfs] starting...`)
    console.log(`[gtfs] GTFS_URL: ${GTFS_URL}`)

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) {
        throw new Error(
            'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (e.g. in .env file)'
        )
    }

    const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    await ignoreErrors(
        supabase
            .from('gtfs_update_status')
            .update({
                status: 'updating',
                started_at: startTime,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', 1),
        '[GTFS] status update skipped (table may not exist yet)'
    )

    console.log('[GTFS] downloading…')
    const res = await fetch(GTFS_URL)
    if (!res.ok) {
        throw new Error(
            `Failed to download GTFS: ${res.status} ${res.statusText}`
        )
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const hash = sha256(buf)
    console.log(`[GTFS] downloaded ${buf.length} bytes, SHA256: ${hash}`)

    const { data: existing, error: existingError } = await supabase
        .from('gtfs_imports')
        .select('id')
        .eq('file_hash', hash)
        .eq('status', 'success')
        .maybeSingle()

    if (existingError) throw existingError
    if (existing) {
        console.log('[gtfs] same hash — skip')
        return
    }

    const { data: importRow, error: insertError } = await supabase
        .from('gtfs_imports')
        .upsert(
            { file_hash: hash, status: 'loading', error_message: null },
            { onConflict: 'file_hash' }
        )
        .select('id')
        .single()

    if (insertError) throw insertError
    const importId = importRow.id

    try {
        const zip = new AdmZip(buf)

        const readText = (name: string) => {
            const entry = zip.getEntry(name)
            if (!entry) throw new Error(`Missing GTFS file: ${name}`)
            return entry.getData().toString('utf-8')
        }

        const parseCSV = (name: string) =>
            parse(readText(name), {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
            }) as Record<string, string>[]

        let feedVersion: string | null = null

        try {
            const feedInfo = parseCSV('feed_info.txt')
            feedVersion = feedInfo[0]?.feed_version ?? null
        } catch (e) {}

        console.log(`[GTFS] truncate staging...`)
        const { error: truncError } = await supabase.rpc(
            'truncate_gtfs_staging'
        )
        if (truncError) throw truncError

        // 1. routes
        const routes = parseCSV('routes.txt').map((row) => ({
            route_id: row.route_id,
            agency_id: row.agency_id,
            route_short_name: row.route_short_name,
            route_long_name: row.route_long_name,
            route_type: row.route_type,
            route_color: row.route_color,
        }))

        await bulkInsert(supabase, 'gtfs_staging_routes', routes)

        // 2. stops
        const stops = parseCSV('stops.txt').map((row) => ({
            stop_id: row.stop_id,
            stop_code: emptyToNull(row.stop_code),
            stop_name: emptyToNull(row.stop_name),
            stop_lat: row.stop_lat ? Number(row.stop_lat) : null,
            stop_lon: row.stop_lon ? Number(row.stop_lon) : null,
            route_type: null as number | null,
        }))
        await bulkInsert(supabase, 'gtfs_staging_stops', stops)

        // 3. calender
        const calendar = parseCSV('calendar.txt').map((row) => ({
            service_id: row.service_id,
            monday: row.monday === '1',
            tuesday: row.tuesday === '1',
            wednesday: row.wednesday === '1',
            thursday: row.thursday === '1',
            friday: row.friday === '1',
            saturday: row.saturday === '1',
            sunday: row.sunday === '1',
            start_date: formatGtfsDate(row.start_date),
            end_date: formatGtfsDate(row.end_date),
        }))

        await bulkInsert(supabase, 'gtfs_staging_calendar', calendar)

        // 4. calendar_dates
        const calDates = parseCSV('calendar_dates.txt').map((row) => ({
            service_id: row.service_id,
            date: formatGtfsDate(row.date),
            exception_type: row.exception_type
                ? Number(row.exception_type)
                : null,
        }))
        await bulkInsert(supabase, 'gtfs_staging_calendar_dates', calDates)

        // trips
        const trips = parseCSV('trips.txt').map((row) => ({
            trip_id: row.trip_id,
            route_id: emptyToNull(row.route_id),
            service_id: emptyToNull(row.service_id),
            trip_headsign: emptyToNull(row.trip_headsign),
            direction_id:
                row.direction_id !== undefined && row.direction_id !== ''
                    ? Number(row.direction_id)
                    : null,
            shape_id: emptyToNull(row.shape_id),
            block_id: emptyToNull(row.block_id),
        }))
        await bulkInsert(supabase, 'gtfs_staging_trips', trips)

        // 6.stop_times
        const stopTimes = parseCSV('stop_times.txt').map((row) => ({
            trip_id: row.trip_id,
            stop_id: emptyToNull(row.stop_id),
            arrival_time: emptyToNull(row.arrival_time),
            departure_time: emptyToNull(row.departure_time),
            stop_sequence: Number(row.stop_sequence),
        }))
        await bulkInsert(supabase, 'gtfs_staging_stop_times', stopTimes, 1000)

        // 7. shapes
        const shapes = parseCSV('shapes.txt').map((row) => ({
            shape_id: row.shape_id,
            shape_pt_sequence: Number(row.shape_pt_sequence),
            shape_pt_lat: Number(row.shape_pt_lat),
            shape_pt_lon: Number(row.shape_pt_lon),
        }))
        await bulkInsert(supabase, 'gtfs_staging_shapes', shapes, 1000)

        const rowCounts = {
            routes: routes.length,
            stops: stops.length,
            trips: trips.length,
            stop_times: stopTimes.length,
            calendar: calendar.length,
            calendar_dates: calDates.length,
            shapes: shapes.length,
        }

        // Sanity check: a broken download or upstream schema change can silently parse into near-empty tables. Abort before swapping into production
        if (rowCounts.stops < 1000 || rowCounts.trips < 1000) {
            throw new Error(`Row counts too low: ${JSON.stringify(rowCounts)}`)
        }

        console.log('[gtfs] swap to production…')
        const dbUrl = process.env.SUPABASE_DB_URL
        if (!dbUrl)
            throw new Error(
                'Set SUPABASE_DB_URL (direct Postgres connection string)'
            )
        const pgClient = new Client({ connectionString: dbUrl })
        pgClient.on('notice', (msg) => console.log('[swap]', msg.message))
        await pgClient.connect()
        try {
            await pgClient.query('SELECT public.swap_gtfs_from_staging()')
        } finally {
            await pgClient.end()
        }

        await supabase
            .from('gtfs_imports')
            .update({
                status: 'success',
                feed_version: feedVersion,
                row_counts: rowCounts,
            })
            .eq('id', importId)

        await ignoreErrors(
            supabase
                .from('gtfs_update_status')
                .update({
                    status: 'success',
                    last_update: startTime,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', 1),
            '[gtfs] status update skipped'
        )

        await supabase.rpc('truncate_gtfs_staging')

        console.log('[gtfs] done', rowCounts)
    } catch (e) {
        const message =
            e instanceof Error
                ? e.message
                : typeof e === 'object' && e !== null && 'message' in e
                  ? String((e as { message: unknown }).message)
                  : String(e)
        await supabase
            .from('gtfs_imports')
            .update({ status: 'failed', error_message: message })
            .eq('id', importId)

        await ignoreErrors(
            supabase
                .from('gtfs_update_status')
                .update({
                    status: 'failed',
                    error_message: message,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', 1),
            '[gtfs] status update skipped'
        )

        console.error('[gtfs] failed:', message)
        process.exitCode = 1
    }
}

main().catch((e) => {
    console.error(
        '[gtfs] unhandled failure:',
        e instanceof Error ? e.message : e
    )
    process.exitCode = 1
})
