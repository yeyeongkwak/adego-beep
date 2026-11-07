import { createHash } from 'node:crypto'
import type { BusLeg, Journey, LatLng } from '@/types/route'

/* Stable id for a saved journey: same origin, destination and rides -> same
id, whoever saves it, so re-tapping a card reuses its row. Hashed so the URL
doesn't expose coordinates (origin is often someone's home) and can't be
guessed. 16 base64url chars = 96 bits.
*/

// ~11m grid: the same start point picked twice still matches.
const at = (p: LatLng) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`

// tripId + timetable time pins one ride on one day (GTFS trip ids repeat
// daily). Unmatched rides fall back to the line name + Google's time.
const ride = (b: BusLeg) =>
    `${b.tripId ?? b.route}@${b.scheduledDepartureEpoch ?? ''}`

export function journeyId(journey: Journey): string {
    const rides = journey.legs.filter((l): l is BusLeg => l.type === 'bus')
    const key = [
        at(journey.origin),
        at(journey.destination),
        ...rides.map(ride),
    ].join('|')
    // To protect privacy, hash the key rather than exposing it in the URL. 16 chars
    return createHash('sha256').update(key).digest('base64url').slice(0, 16)
}
