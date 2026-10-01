import type { SupabaseClient } from '@supabase/supabase-js'

// A block_id chains the trips run by one physical vehicle across a bus-number
// change mid-journey. To follow that vehicle in the realtime feed (which
// reports whichever trip it's currently running), resolve the trip's block and
// return every trip sharing it — the requested trip included.
//
// If the trip has no block_id (some feeds omit it), just return the trip
// itself; matching then falls back to that single trip.
export async function getBlockTripIds(
    db: SupabaseClient,
    tripId: string
): Promise<string[]> {
    const trip = await db
        .from('gtfs_trips')
        .select('block_id')
        .eq('trip_id', tripId)
        .maybeSingle()
    if (trip.error || !trip.data) return [tripId]

    const blockId = trip.data.block_id
    if (!blockId) return [tripId]

    const siblings = await db
        .from('gtfs_trips')
        .select('trip_id')
        .eq('block_id', blockId)
    if (siblings.error || !siblings.data?.length) return [tripId]

    return siblings.data.map((r) => r.trip_id as string)
}
