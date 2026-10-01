import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getStopArrivals } from '@/lib/arrivals/stopArrivals'
import { getBlockTripIds } from '@/lib/arrivals/block'
import { findVehicleForTrips } from '@/lib/arrivals/realtime'
import { distanceMeters } from '@/lib/utils'
import { decodePolyline } from '@/util/map/polyline'
import type { StopMode } from '@/types/common'
import type {
    GoogleRoute,
    LatLng,
    BusLeg,
    Journey,
    JourneyLeg,
    RouteStop,
    StopArrival,
    VehiclePosition,
    GoogleStop,
    TransitStep,
} from '@/types/route'

/* Transit directions: Google Routes API (New) plans the journey (which lines,
where to walk), then each ride's times are swapped for our own GTFS data —
the realtime prediction when the trip is tracked, otherwise the timetable.
If a ride can't be matched to our data, Google's time is kept as a fallback.
*/
const COMPUTE_ROUTES_URL =
    'https://routes.googleapis.com/directions/v2:computeRoutes'
const TZ = 'Australia/Adelaide'

// Only request what the cards render.
const FIELD_MASK = [
    'routes.duration',
    'routes.legs.duration',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.polyline',
    'routes.legs.steps.transitDetails',
].join(',')

// GTFS matching tuning.
const STOP_SEARCH_DEG = 0.0015 // ~165m box around Google's stop
const STOP_MAX_DISTANCE_M = 120
const ARRIVALS_WINDOW_MINUTES = 180
const ARRIVALS_LIMIT = 80
const MATCH_TOLERANCE_S = 15 * 60

// Google transit vehicle types -> our BUS/TRAM/RAIL grouping.
function vehicleTypeToMode(type: string | undefined): StopMode {
    switch (type) {
        case 'TRAM':
        case 'LIGHT_RAIL':
        case 'MONORAIL':
            return 'TRAM'
        case 'RAIL':
        case 'HEAVY_RAIL':
        case 'COMMUTER_TRAIN':
        case 'HIGH_SPEED_TRAIN':
        case 'METRO_RAIL':
        case 'SUBWAY':
            return 'RAIL'
        default:
            return 'BUS'
    }
}

// "754s" -> 754. Routes API returns durations as second strings.
function durationToSeconds(value: string | undefined): number {
    if (!value) return 0
    const seconds = Number(String(value).replace('s', ''))
    return Number.isFinite(seconds) ? seconds : 0
}

function isoToEpoch(iso: string | undefined): number | null {
    if (!iso) return null
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

// Clock time in Adelaide regardless of the server's own timezone (UTC on
// Vercel), so "11:48 am" matches what the rider sees locally.
function formatClock(epoch: number | null): string {
    if (epoch == null) return ''
    return new Date(epoch * 1000).toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: TZ,
    })
}

function minutesFromNow(epoch: number, nowEpoch: number): number {
    return Math.max(0, Math.round((epoch - nowEpoch) / 60))
}

function toRouteStop(stop: GoogleStop | undefined): RouteStop | null {
    const ll = stop?.location?.latLng
    if (!ll) return null
    return { name: stop?.name ?? '', lat: ll.latitude, lng: ll.longitude }
}

const decodeStep = (step: TransitStep): LatLng[] =>
    step.polyline?.encodedPolyline
        ? decodePolyline(step.polyline.encodedPolyline)
        : []

// A ride as Google describes it (times are Google's, replaced later).
function mapTransitStep(step: TransitStep, nowEpoch: number): BusLeg {
    const td = step.transitDetails
    const line = td?.transitLine
    const from = toRouteStop(td?.stopDetails?.departureStop)
    const to = toRouteStop(td?.stopDetails?.arrivalStop)
    const departureEpoch = isoToEpoch(td?.stopDetails?.departureTime)
    return {
        type: 'bus',
        mode: vehicleTypeToMode(line?.vehicle?.type),
        route: line?.nameShort ?? line?.name ?? '?',
        color: line?.color ?? null,
        headsign: td?.headsign ?? '',
        from: from?.name ?? '',
        fromCode: null,
        to: to?.name ?? '',
        // Google doesn't list intermediate stops; boarding + alighting only.
        // Enriched later with the full GTFS stop list + shape.
        path: [from, to].filter((s): s is RouteStop => s != null),
        // Google's road line for just this ride, until the GTFS shape loads.
        shape: decodeStep(step),
        tripId: null, // filled by the enricher once matched to a GTFS trip
        minutes: Math.round(durationToSeconds(step.staticDuration) / 60),
        departureEpoch,
        departsIn:
            departureEpoch != null
                ? minutesFromNow(departureEpoch, nowEpoch)
                : 0,
        live: false,
        delayMin: null,
        vehicle: null,
    }
}

// Google splits walking into one step per instruction ("turn left…"), so
//consecutive walk steps are summed into a single walk leg.

function buildLegs(steps: TransitStep[], nowEpoch: number): JourneyLeg[] {
    const legs: JourneyLeg[] = []
    let walkSeconds = 0
    let walkPath: LatLng[] = []
    const flushWalk = () => {
        const minutes = Math.round(walkSeconds / 60)
        if (minutes > 0)
            legs.push({ type: 'walk', minutes, to: '', path: walkPath })
        walkSeconds = 0
        walkPath = []
    }
    for (const step of steps) {
        if (step.travelMode === 'TRANSIT') {
            flushWalk()
            legs.push(mapTransitStep(step, nowEpoch))
        } else {
            walkSeconds += durationToSeconds(step.staticDuration)
            walkPath.push(...decodeStep(step))
        }
    }
    flushWalk()
    return legs
}

type GtfsStop = { stopId: string; code: string | null }

// Google's boarding stop -> our nearest GTFS stop (names usually match too,
// since Google ingests Adelaide Metro's feed; name breaks distance ties).
async function findGtfsStop(
    db: SupabaseClient,
    stop: RouteStop
): Promise<GtfsStop | null> {
    const { data, error } = await db
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon')
        .gte('stop_lat', stop.lat - STOP_SEARCH_DEG)
        .lte('stop_lat', stop.lat + STOP_SEARCH_DEG)
        .gte('stop_lon', stop.lng - STOP_SEARCH_DEG)
        .lte('stop_lon', stop.lng + STOP_SEARCH_DEG)
    if (error || !data?.length) return null

    let best: { row: (typeof data)[number]; score: number } | null = null
    for (const row of data) {
        if (row.stop_lat == null || row.stop_lon == null) continue
        const d = distanceMeters(stop, { lat: row.stop_lat, lng: row.stop_lon })
        if (d > STOP_MAX_DISTANCE_M) continue
        const score = row.stop_name === stop.name ? d - 1000 : d
        if (!best || score < best.score) best = { row, score }
    }
    return best ? { stopId: best.row.stop_id, code: best.row.stop_code } : null
}

const normRoute = (r: string) => r.trim().toUpperCase()

// The trip on the same line whose timetable time is closest to Google's.
// Compare against the scheduled time so a late bus still matches its own
// trip rather than the next one.
function pickArrival(
    arrivals: StopArrival[],
    leg: BusLeg,
    nowEpoch: number
): StopArrival | null {
    const sameLine = arrivals.filter(
        (a) => normRoute(a.route) === normRoute(leg.route)
    )
    if (sameLine.length === 0) return null
    const target = leg.departureEpoch ?? nowEpoch
    let best: StopArrival | null = null
    let bestGap = Infinity
    for (const a of sameLine) {
        const gap = Math.abs((a.scheduledEpoch ?? a.arrivalEpoch) - target)
        if (gap < bestGap) {
            best = a
            bestGap = gap
        }
    }
    // Without a Google time there's nothing to check against, so the trip
    // closest to now (possibly one that just left) is the best guess.
    if (leg.departureEpoch != null && bestGap > MATCH_TOLERANCE_S) return null
    return best
}

// Swap Google's ride times for ours. Lookups are memoised per request because
// alternative routes usually share boarding stops.
function createEnricher(db: SupabaseClient, nowEpoch: number) {
    const stopCache = new Map<string, Promise<GtfsStop | null>>()
    const arrivalsCache = new Map<string, Promise<StopArrival[]>>()
    const vehicleCache = new Map<string, Promise<VehiclePosition | null>>()

    const stopFor = (s: RouteStop) => {
        const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`
        if (!stopCache.has(key)) stopCache.set(key, findGtfsStop(db, s))
        return stopCache.get(key)!
    }
    const arrivalsFor = (stopId: string) => {
        if (!arrivalsCache.has(stopId)) {
            arrivalsCache.set(
                stopId,
                getStopArrivals(db, stopId, {
                    limit: ARRIVALS_LIMIT,
                    windowMinutes: ARRIVALS_WINDOW_MINUTES,
                })
                    .then((r) => r.arrivals)
                    .catch(() => [])
            )
        }
        return arrivalsCache.get(stopId)!
    }
    // Live vehicle for a trip, following its block chain across trip_id changes.
    const vehicleFor = (tripId: string) => {
        if (!vehicleCache.has(tripId)) {
            vehicleCache.set(
                tripId,
                getBlockTripIds(db, tripId)
                    .then((tripIds) => findVehicleForTrips(tripIds))
                    .catch(() => null)
            )
        }
        return vehicleCache.get(tripId)!
    }

    return async (leg: BusLeg): Promise<BusLeg> => {
        const boarding = leg.path[0]
        if (!boarding) return leg
        const stop = await stopFor(boarding)
        if (!stop) return leg
        const match = pickArrival(await arrivalsFor(stop.stopId), leg, nowEpoch)
        if (!match) return { ...leg, fromCode: stop.code }

        const enriched: BusLeg = {
            ...leg,
            fromCode: stop.code,
            color: match.color ?? leg.color,
            departureEpoch: match.arrivalEpoch,
            departsIn: minutesFromNow(match.arrivalEpoch, nowEpoch),
            live: match.live,
            delayMin: match.delayMin,
            // Carried so the vehicle-map sheet can fetch stops/shape on demand.
            tripId: match.tripId,
        }

        // Live vehicle location, following the block chain across trip_id
        // changes (bus number can change mid-run).
        const vehicle = await vehicleFor(match.tripId)
        if (!vehicle) return enriched

        // A stops-away count is only meaningful when the vehicle is on this very
        // trip (stop_sequence is per-trip); otherwise leave it null.
        const sameTrip = vehicle.tripId === match.tripId
        const stopsAway =
            sameTrip &&
            match.stopSequence != null &&
            vehicle.currentStopSequence != null
                ? Math.max(0, match.stopSequence - vehicle.currentStopSequence)
                : null
        enriched.vehicle = {
            lat: vehicle.lat,
            lng: vehicle.lng,
            stopsAway,
            nearStop: boarding.name,
        }
        return enriched
    }
}

export async function POST(request: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'Directions is not configured' },
            { status: 500 }
        )
    }

    const body = await request.json().catch(() => null)
    const origin = body?.origin
    const destination = body?.destination
    if (
        !origin ||
        !destination ||
        typeof origin.lat !== 'number' ||
        typeof destination.lat !== 'number'
    ) {
        return NextResponse.json(
            { error: 'origin and destination coordinates are required' },
            { status: 400 }
        )
    }

    try {
        const res = await fetch(COMPUTE_ROUTES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify({
                origin: {
                    location: {
                        latLng: {
                            latitude: origin.lat,
                            longitude: origin.lng,
                        },
                    },
                },
                destination: {
                    location: {
                        latLng: {
                            latitude: destination.lat,
                            longitude: destination.lng,
                        },
                    },
                },
                travelMode: 'TRANSIT',
                computeAlternativeRoutes: true,
            }),
        })
        const data = await res.json()
        if (!res.ok) {
            console.warn(
                `[directions] ${res.status}: ${data?.error?.message ?? 'unknown'}`
            )
            return NextResponse.json({ journeys: [] })
        }

        const nowEpoch = Math.floor(Date.now() / 1000)
        const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        )
        const enrich = createEnricher(db, nowEpoch)

        const originStop: RouteStop = {
            name: origin.label ?? 'Start',
            lat: origin.lat,
            lng: origin.lng,
        }
        const destStop: RouteStop = {
            name: destination.label ?? 'Destination',
            lat: destination.lat,
            lng: destination.lng,
        }

        const built = await Promise.all(
            ((data.routes ?? []) as GoogleRoute[]).map(async (route, i) => {
                // Google Routes API always returns transit journeys as a
                // single leg (origin→destination), regardless of transfers.
                // The individual walk/ride segments live inside steps[].
                const steps = route.legs?.[0]?.steps ?? []
                const legs = await Promise.all(
                    buildLegs(steps, nowEpoch).map((leg) =>
                        leg.type === 'bus' ? enrich(leg) : leg
                    )
                )

                const rides = legs.filter((l): l is BusLeg => l.type === 'bus')
                const transitSteps = steps.filter(
                    (s) => s.travelMode === 'TRANSIT'
                )
                // Arrival stays Google's timetable, shifted by the last ride's
                // live delay when we know it (lateness tends to carry through),
                // plus the walk from the last stop to the destination.
                const lastArrival = isoToEpoch(
                    transitSteps[transitSteps.length - 1]?.transitDetails
                        ?.stopDetails?.arrivalTime
                )
                const lastDelay = rides[rides.length - 1]?.delayMin ?? 0
                const finalWalkMin = legs
                    .slice(legs.findLastIndex((l) => l.type === 'bus') + 1)
                    .reduce((sum, l) => sum + l.minutes, 0)
                const arriveEpoch =
                    lastArrival != null
                        ? lastArrival + (lastDelay + finalWalkMin) * 60
                        : null

                const journey: Journey = {
                    id: `route-${i}`,
                    origin: originStop,
                    destination: destStop,
                    departAt: formatClock(rides[0]?.departureEpoch ?? null),
                    arriveAt: formatClock(arriveEpoch),
                    minutes: Math.round(durationToSeconds(route.duration) / 60),
                    legs,
                }
                // Keep the sort key alongside; Google's order isn't arrival-time
                // sorted, and swapping in our GTFS times shifts it further.
                return { journey, arriveEpoch }
            })
        )

        // Soonest arrival first; unknown arrival times sink to the bottom.
        built.sort(
            (a, b) => (a.arriveEpoch ?? Infinity) - (b.arriveEpoch ?? Infinity)
        )
        const journeys: Journey[] = built.map((b) => b.journey)

        return NextResponse.json({ journeys })
    } catch (error) {
        console.warn('[directions] failed:', (error as Error).message)
        return NextResponse.json({ journeys: [] })
    }
}
