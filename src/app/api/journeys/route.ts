import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { journeyId } from '@/lib/journeyId'
import { createPublicClient, createSecretClient } from '@/lib/supabase'
import { getTripStops, rideStops } from '@/lib/tripStops'
import type { Journey, JourneyLeg } from '@/types/route'

/* Saves a journey the user opened from the route list and returns its id, so
/route/<id> reopens it later on any device. The id is computed here, never
taken from the client, so nobody can overwrite another journey's row.
*/

// A real journey is ~5-30KB; this only stops someone filling the table.
const MAX_BYTES = 64 * 1024

const isPoint = (p: unknown): boolean => {
    const o = p as { lat?: unknown; lng?: unknown } | null
    return (
        typeof o?.lat === 'number' &&
        Number.isFinite(o.lat) &&
        typeof o?.lng === 'number' &&
        Number.isFinite(o.lng)
    )
}

// Shape check only: enough to compute the id and render, not a full schema.
function isJourney(j: unknown): j is Journey {
    const o = j as Partial<Journey> | null
    return (
        isPoint(o?.origin) &&
        isPoint(o?.destination) &&
        Array.isArray(o?.legs) &&
        o.legs.every((l) => l?.type === 'walk' || l?.type === 'bus')
    )
}

// Google only gives boarding + alighting; swap in every stop the ride passes,
// from GTFS. Saved now (not looked up on open) so old links keep their stops
// after a GTFS update renumbers trips. Unmatched rides keep Google's two.
async function withRideStops(
    db: SupabaseClient,
    leg: JourneyLeg
): Promise<JourneyLeg> {
    if (leg.type !== 'bus') return leg
    // The live bus position is stale by the time anyone reopens this.
    const saved = { ...leg, vehicle: null }
    if (!leg.tripId || leg.path.length < 2) return saved
    const stops = await getTripStops(db, leg.tripId).catch(() => [])
    const ridden = rideStops(stops, leg.path[0], leg.path[leg.path.length - 1])
    return ridden ? { ...saved, path: ridden } : saved
}

export async function POST(request: NextRequest) {
    const body = await request.text()
    if (Buffer.byteLength(body) > MAX_BYTES) {
        return NextResponse.json(
            { error: 'Journey too large' },
            { status: 413 }
        )
    }

    let journey: unknown
    try {
        journey = JSON.parse(body)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!isJourney(journey)) {
        return NextResponse.json({ error: 'Invalid journey' }, { status: 400 })
    }

    const id = journeyId(journey)
    const gtfs = createPublicClient()
    const legs = await Promise.all(
        journey.legs.map((leg) => withRideStops(gtfs, leg))
    )

    // Same id = same journey: refresh the stored copy rather than duplicate.
    const { error } = await createSecretClient()
        .from('saved_journeys')
        .upsert({
            id,
            journey: { ...journey, id, legs },
            last_viewed_at: new Date().toISOString(),
        })
    if (error) {
        console.warn('[journeys] save failed:', error.message)
        return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }

    return NextResponse.json({ id })
}
