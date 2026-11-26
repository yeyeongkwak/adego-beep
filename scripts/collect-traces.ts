import { createClient } from '@supabase/supabase-js'
import { getDetourRoutes } from '@/lib/arrivals/alerts'
import { getVehicleSnapshot } from '@/lib/arrivals/realtime'
import { distanceMeters } from '@/util/map/distance'

// Samples live positions of buses on routes with a detour notice into
// vehicle_traces, so we can later show where a detour really goes. Runs for
// RUN_MINUTES (GitHub Actions starts it every hour).

const RUN_MINUTES = Number(process.env.RUN_MINUTES ?? 55)
const POLL_MS = 30_000
// A bus standing at a stop or a light sends the same spot again.
const MIN_MOVE_M = 30
const KEEP_DAYS = 1

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key)
        throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY')
    const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString()
    const old = await db
        .from('vehicle_traces')
        .delete()
        .lt('recorded_at', cutoff)
    if (old.error) throw new Error(`cleanup: ${old.error.message}`)

    const last = new Map<string, { lat: number; lng: number }>()
    const end = Date.now() + RUN_MINUTES * 60_000
    let saved = 0
    while (Date.now() < end) {
        try {
            const routes = await getDetourRoutes(Date.now() / 1000)
            const snap = await getVehicleSnapshot()
            const at = new Date(
                (snap.feedTimestamp || Date.now() / 1000) * 1000
            ).toISOString()
            const rows = [...snap.byTripId.values()]
                .filter((v) => v.routeId && routes.has(v.routeId))
                .filter((v) => {
                    const prev = last.get(v.tripId)
                    return !prev || distanceMeters(prev, v) >= MIN_MOVE_M
                })
                .map((v) => ({
                    route_id: v.routeId!,
                    trip_id: v.tripId,
                    lat: v.lat,
                    lng: v.lng,
                    recorded_at: at,
                }))
            if (rows.length) {
                const res = await db
                    .from('vehicle_traces')
                    .upsert(rows, { ignoreDuplicates: true })
                if (res.error) throw new Error(res.error.message)
                for (const r of rows) last.set(r.trip_id, r)
                saved += rows.length
            }
            console.log(
                `[traces] ${at} detour routes=${routes.size} saved=${rows.length}`
            )
        } catch (e) {
            // One bad poll (feed hiccup) shouldn't end the run.
            console.warn(
                '[traces] poll failed:',
                e instanceof Error ? e.message : e
            )
        }
        await sleep(POLL_MS)
    }
    console.log(`[traces] done, ${saved} points`)
}

main().catch((e) => {
    console.error('[traces] failed:', e instanceof Error ? e.message : e)
    process.exitCode = 1
})
