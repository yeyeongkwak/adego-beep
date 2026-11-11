import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getStopArrivals } from '@/lib/arrivals/stopArrivals'
import { getBlockTripIds } from '@/lib/arrivals/block'
import { findVehicleForTrips, getTripUpdates } from '@/lib/arrivals/realtime'
import { getTripCalls, nearestIndex, type TripCall } from '@/lib/tripStops'
import { distanceMeters } from '@/lib/utils'
import type { StopMode } from '@/types/common'
import type {
    GoogleRoute,
    BusLeg,
    Journey,
    JourneyLeg,
    LatLng,
    RouteStop,
    StopArrival,
    StopArrivalUpdate,
    VehiclePosition,
    GoogleStop,
    TransitStep,
} from '@/types/route'

// Google finds the route. Then we change each ride's times to our GTFS times
// (live or timetable). If we can't match a ride, we keep Google's time.
const COMPUTE_ROUTES_URL =
    'https://routes.googleapis.com/directions/v2:computeRoutes'
const TZ = 'Australia/Adelaide'

// Ask only for what the cards show.
const FIELD_MASK = [
    'routes.duration',
    'routes.legs.duration',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.polyline',
    'routes.legs.steps.transitDetails',
].join(',')

// Settings for matching GTFS.
const STOP_SEARCH_DEG = 0.0015 // about 165m around Google's stop
const STOP_MAX_DISTANCE_M = 120
const STOP_CANDIDATES = 4
const ARRIVALS_WINDOW_MINUTES = 180
const ARRIVALS_LIMIT = 80
const MATCH_TOLERANCE_S = 15 * 60
const ALIGHT_MAX_DISTANCE_M = 250
const TRANSFER_BUFFER_S = 60
const DEPARTED_GRACE_S = 60

// Google vehicle types -> our BUS/TRAM/RAIL.
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

// "754s" -> 754. Google gives durations like this.
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

// Time in Adelaide. The server can be in UTC (Vercel), so we set the timezone.
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

// A ride from Google. We change the times later.
function mapTransitStep(step: TransitStep, nowEpoch: number): BusLeg {
    const td = step.transitDetails
    const line = td?.transitLine
    const from = toRouteStop(td?.stopDetails?.departureStop)
    const to = toRouteStop(td?.stopDetails?.arrivalStop)
    const departureEpoch = isoToEpoch(td?.stopDetails?.departureTime)
    const arrivalEpoch = isoToEpoch(td?.stopDetails?.arrivalTime)
    return {
        type: 'bus',
        mode: vehicleTypeToMode(line?.vehicle?.type),
        route: line?.nameShort ?? line?.name ?? '?',
        color: line?.color ?? null,
        headsign: td?.headsign ?? '',
        from: from?.name ?? '',
        fromCode: null,
        to: to?.name ?? '',
        // Google gives only the start and end stops. We add all stops later.
        path: [from, to].filter((s): s is RouteStop => s != null),
        shape: [],
        // Kept encoded because it is much smaller.
        polyline: step.polyline?.encodedPolyline ?? null,
        tripId: null, // set later when we match a GTFS trip
        minutes: Math.round(durationToSeconds(step.staticDuration) / 60),
        departureEpoch,
        scheduledDepartureEpoch: departureEpoch,
        arrivalEpoch,
        arrivalLive: false,
        departsIn:
            departureEpoch != null
                ? minutesFromNow(departureEpoch, nowEpoch)
                : 0,
        live: false,
        delayMin: null,
        vehicle: null,
    }
}

// Google gives one walk step per instruction, so we add them into one walk.

function buildLegs(
    steps: TransitStep[],
    nowEpoch: number,
    destinationName: string
): JourneyLeg[] {
    const legs: JourneyLeg[] = []
    let walkSeconds = 0
    let walkPolylines: string[] = []
    const flushWalk = () => {
        const minutes = Math.round(walkSeconds / 60)
        if (minutes > 0)
            legs.push({
                type: 'walk',
                minutes,
                to: '',
                polylines: walkPolylines,
            })
        walkSeconds = 0
        walkPolylines = []
    }
    for (const step of steps) {
        if (step.travelMode === 'TRANSIT') {
            flushWalk()
            legs.push(mapTransitStep(step, nowEpoch))
        } else {
            walkSeconds += durationToSeconds(step.staticDuration)
            const encoded = step.polyline?.encodedPolyline
            if (encoded) walkPolylines.push(encoded)
        }
    }
    flushWalk()
    // Where each walk ends: the next bus stop, or the destination.
    legs.forEach((leg, i) => {
        if (leg.type !== 'walk') return
        const next = legs[i + 1]
        leg.to = next?.type === 'bus' ? next.from : destinationName
    })
    return legs
}

type GtfsStop = { stopId: string; code: string | null }

// GTFS stops near Google's stop, best first. Google gives one station name,
// but each direction has its own platform, so we try a few.
async function findGtfsStops(
    db: SupabaseClient,
    stop: RouteStop
): Promise<GtfsStop[]> {
    // Use `*` so it still works on a DB without location_type (009).
    const { data, error } = await db
        .from('gtfs_stops')
        .select('*')
        .gte('stop_lat', stop.lat - STOP_SEARCH_DEG)
        .lte('stop_lat', stop.lat + STOP_SEARCH_DEG)
        .gte('stop_lon', stop.lng - STOP_SEARCH_DEG)
        .lte('stop_lon', stop.lng + STOP_SEARCH_DEG)
    if (error || !data?.length) return []

    const scored: { stop: GtfsStop; score: number }[] = []
    for (const row of data) {
        if (row.stop_lat == null || row.stop_lon == null) continue
        // Stations and entrances have no buses. Only 0 or empty is a real stop.
        if (row.location_type != null && row.location_type !== 0) continue
        const d = distanceMeters(stop, { lat: row.stop_lat, lng: row.stop_lon })
        const sameName = (row.stop_name ?? '').startsWith(stop.name)
        // Google's pin can be a bit off. If the name matches, allow further.
        if (d > STOP_MAX_DISTANCE_M && !sameName) continue
        const score = sameName ? d - 1000 : d
        scored.push({
            stop: { stopId: row.stop_id, code: row.stop_code },
            score,
        })
    }
    return scored
        .sort((a, b) => a.score - b.score)
        .slice(0, STOP_CANDIDATES)
        .map((s) => s.stop)
}

const norm = (r: string) => r.trim().toUpperCase()

type ArrivalMatch = { arrival: StopArrival; sameHeadsign: boolean; gap: number }

// Same direction (headsign) first, then the closest time.
const isBetter = (a: ArrivalMatch, b: ArrivalMatch | null) =>
    !b || (a.sameHeadsign !== b.sameHeadsign ? a.sameHeadsign : a.gap < b.gap)

// Google's time can be live or timetable, so we check both. If the rider
// can't make it or the bus is cancelled, take the next bus.
function pickArrival(
    arrivals: StopArrival[],
    leg: BusLeg,
    nowEpoch: number,
    notBefore: number | null
): ArrivalMatch | null {
    const planned = leg.departureEpoch ?? nowEpoch
    const sameLine = (a: StopArrival) => norm(a.route) === norm(leg.route)
    const sameHeadsign = (a: StopArrival) =>
        norm(a.destination) === norm(leg.headsign)
    const gapTo = (a: StopArrival, t: number) =>
        Math.min(
            Math.abs(a.arrivalEpoch - t),
            Math.abs((a.scheduledEpoch ?? a.arrivalEpoch) - t)
        )
    const missed = notBefore != null && planned < notBefore
    const cancelled =
        leg.departureEpoch != null &&
        arrivals.some(
            (a) =>
                a.cancelled &&
                sameLine(a) &&
                sameHeadsign(a) &&
                gapTo(a, planned) <= MATCH_TOLERANCE_S
        )
    const target = missed ? notBefore : planned
    let best: ArrivalMatch | null = null
    for (const a of arrivals) {
        if (a.cancelled || !sameLine(a)) continue
        if (notBefore != null && a.arrivalEpoch < notBefore) continue
        if (cancelled && a.arrivalEpoch < planned) continue
        const gap = gapTo(a, target)
        if (
            leg.departureEpoch != null &&
            !missed &&
            !cancelled &&
            gap > MATCH_TOLERANCE_S
        )
            continue
        const match = { arrival: a, sameHeadsign: sameHeadsign(a), gap }
        if (isBetter(match, best)) best = match
    }
    return best
}

// Timetable time at the get-off stop + the delay from the last live time
// before it. The feed often has only the next few stops.
function alightingTime(
    calls: TripCall[],
    updates: StopArrivalUpdate[],
    match: StopArrival,
    alight: RouteStop
): { epoch: number; live: boolean } | null {
    const b = calls.findIndex((c) => c.stopSequence === match.stopSequence)
    const boardSecs =
        b >= 0 ? (calls[b].departureSecs ?? calls[b].arrivalSecs) : null
    if (boardSecs == null || match.scheduledEpoch == null) return null
    const a = nearestIndex(calls, alight, b + 1)
    if (a < 0 || distanceMeters(calls[a], alight) > ALIGHT_MAX_DISTANCE_M)
        return null

    const midnight = match.scheduledEpoch - boardSecs
    const scheduledAt = (i: number) => {
        const secs = calls[i].arrivalSecs ?? calls[i].departureSecs
        return secs == null ? null : midnight + secs
    }
    const alightAt = scheduledAt(a)
    if (alightAt == null) return null

    // On a loop, the last stop has the same id as the first one, so skip
    // times before boarding.
    const byStop = new Map(
        updates
            .filter((u) => u.arrivalEpoch >= match.arrivalEpoch)
            .map((u) => [u.stopId, u])
    )
    const boardDelay = match.live
        ? match.arrivalEpoch - match.scheduledEpoch
        : 0
    // For buses that haven't started, the feed says they are early, but buses
    // wait at timing points. So don't be more early than at boarding.
    const earliest = alightAt + Math.min(boardDelay, 0)
    for (let i = a; i > b; i--) {
        const update = byStop.get(calls[i].stopId)
        const at = scheduledAt(i)
        if (update && at != null)
            return {
                epoch: Math.max(earliest, alightAt + update.arrivalEpoch - at),
                live: true,
            }
    }
    return { epoch: alightAt + boardDelay, live: match.live }
}

// Count by position, not stop number. Adelaide uses 999 for every last stop,
// and on a loop a bus waiting at the start also shows as 999.
function stopsAway(
    calls: TripCall[],
    boardingSequence: number | null,
    vehicleSequence: number | null
): number | null {
    const b = calls.findIndex((c) => c.stopSequence === boardingSequence)
    let v = calls.findIndex((c) => c.stopSequence === vehicleSequence)
    if (b < 0 || v < 0) return null
    const last = calls.length - 1
    if (v === last && v > b && calls[0].stopId === calls[last].stopId) v = 0
    return Math.max(0, b - v)
}

// Cache per request. Other routes often use the same stops and trips.
function createEnricher(
    db: SupabaseClient,
    nowEpoch: number,
    fromEpoch: number | undefined
) {
    const stopCache = new Map<string, Promise<GtfsStop[]>>()
    const arrivalsCache = new Map<string, Promise<StopArrival[]>>()
    const callsCache = new Map<string, Promise<TripCall[]>>()
    const vehicleCache = new Map<string, Promise<VehiclePosition | null>>()

    const stopsFor = (s: RouteStop) => {
        const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`
        if (!stopCache.has(key)) stopCache.set(key, findGtfsStops(db, s))
        return stopCache.get(key)!
    }
    const arrivalsFor = (stopId: string) => {
        if (!arrivalsCache.has(stopId)) {
            arrivalsCache.set(
                stopId,
                getStopArrivals(db, stopId, {
                    limit: ARRIVALS_LIMIT,
                    windowMinutes: ARRIVALS_WINDOW_MINUTES,
                    fromEpoch,
                })
                    .then((r) => r.arrivals)
                    .catch(() => [])
            )
        }
        return arrivalsCache.get(stopId)!
    }
    const callsFor = (tripId: string) => {
        if (!callsCache.has(tripId))
            callsCache.set(
                tripId,
                getTripCalls(db, tripId).catch(() => [])
            )
        return callsCache.get(tripId)!
    }
    // Find the live vehicle. We follow the block because trip_id can change.
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

    // Rides are matched one by one, so start loading all stops first.
    const prefetch = (leg: BusLeg) => {
        if (leg.path[0])
            void stopsFor(leg.path[0]).then((stops) =>
                stops.forEach((s) => arrivalsFor(s.stopId))
            )
    }

    const enrich = async (
        leg: BusLeg,
        notBefore: number | null
    ): Promise<BusLeg> => {
        const boarding = leg.path[0]
        const alighting = leg.path.length > 1 ? leg.path.at(-1)! : null
        if (!boarding) return leg
        const candidates = await stopsFor(boarding)
        if (candidates.length === 0) return leg
        const matches = await Promise.all(
            candidates.map(async (stop) => ({
                stop,
                match: pickArrival(
                    await arrivalsFor(stop.stopId),
                    leg,
                    nowEpoch,
                    notBefore
                ),
            }))
        )
        let best: { stop: GtfsStop; match: ArrivalMatch } | null = null
        for (const { stop, match } of matches) {
            if (match && isBetter(match, best?.match ?? null))
                best = { stop, match }
        }
        if (!best) return { ...leg, fromCode: candidates[0].code }
        const { stop } = best
        const match = best.match.arrival

        // Blocks repeat every day, so a far trip would find today's vehicle.
        const soon =
            match.arrivalEpoch - nowEpoch <= ARRIVALS_WINDOW_MINUTES * 60
        const [calls, updates, vehicle] = await Promise.all([
            callsFor(match.tripId),
            getTripUpdates(match.tripId),
            soon ? vehicleFor(match.tripId) : null,
        ])
        const alight = alighting
            ? alightingTime(calls, updates, match, alighting)
            : null
        // If no get-off time, move Google's arrival as much as the departure.
        const shifted =
            leg.arrivalEpoch != null && leg.departureEpoch != null
                ? leg.arrivalEpoch + match.arrivalEpoch - leg.departureEpoch
                : null

        const enriched: BusLeg = {
            ...leg,
            fromCode: stop.code,
            color: match.color ?? leg.color,
            departureEpoch: match.arrivalEpoch,
            scheduledDepartureEpoch:
                match.scheduledEpoch ?? leg.scheduledDepartureEpoch,
            arrivalEpoch: alight?.epoch ?? shifted,
            arrivalLive: alight?.live ?? false,
            departsIn: minutesFromNow(match.arrivalEpoch, nowEpoch),
            live: match.live,
            delayMin: match.delayMin,
            // So the map can load stops and shape later.
            tripId: match.tripId,
        }

        if (!vehicle) return enriched
        enriched.vehicle = {
            lat: vehicle.lat,
            lng: vehicle.lng,
            stopsAway:
                vehicle.tripId === match.tripId
                    ? stopsAway(
                          calls,
                          match.stopSequence,
                          vehicle.currentStopSequence
                      )
                    : null,
            nearStop: boarding.name,
        }
        return enriched
    }

    return { enrich, prefetch }
}

type TripTimeBody = { mode: 'depart' | 'arrive'; at: string }

function parseTime(value: unknown): TripTimeBody | null {
    const t = value as Partial<TripTimeBody> | null
    if (t?.mode !== 'depart' && t?.mode !== 'arrive') return null
    const ms = Date.parse(t.at ?? '')
    return Number.isFinite(ms)
        ? { mode: t.mode, at: new Date(ms).toISOString() }
        : null
}

// Google's plan for one option, before we change the times.
type Plan = { legs: JourneyLeg[]; durationS: number }

const isLatLng = (v: unknown) =>
    typeof (v as LatLng)?.lat === 'number' &&
    typeof (v as LatLng)?.lng === 'number'

// Plans come back from the app, so check them before we use them.
function parsePlans(value: unknown): Plan[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > 10)
        return null
    const ok = value.every(
        (p) =>
            typeof p?.durationS === 'number' &&
            Array.isArray(p.legs) &&
            p.legs.length <= 20 &&
            p.legs.every((l: JourneyLeg) =>
                l?.type === 'walk'
                    ? typeof l.minutes === 'number'
                    : l?.type === 'bus' &&
                      typeof l.route === 'string' &&
                      Array.isArray(l.path) &&
                      l.path.every(isLatLng)
            )
    )
    return ok ? (value as Plan[]) : null
}

async function fetchGooglePlans(
    key: string,
    origin: RouteStop,
    destination: RouteStop,
    time: TripTimeBody | null,
    nowEpoch: number
): Promise<Plan[] | null> {
    const latLng = (s: RouteStop) => ({
        location: { latLng: { latitude: s.lat, longitude: s.lng } },
    })
    const res = await fetch(COMPUTE_ROUTES_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
            origin: latLng(origin),
            destination: latLng(destination),
            travelMode: 'TRANSIT',
            computeAlternativeRoutes: true,
            ...(time && {
                [time.mode === 'depart' ? 'departureTime' : 'arrivalTime']:
                    time.at,
            }),
        }),
    })
    const data = await res.json()
    if (!res.ok) {
        console.warn(
            `[directions] ${res.status}: ${data?.error?.message ?? 'unknown'}`
        )
        return null
    }
    // Google gives one leg. Walks and rides are in its steps.
    return ((data.routes ?? []) as GoogleRoute[]).map((route) => ({
        legs: buildLegs(
            route.legs?.[0]?.steps ?? [],
            nowEpoch,
            destination.name
        ),
        durationS: durationToSeconds(route.duration),
    }))
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
    const time = parseTime(body?.time)
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

    const nowEpoch = Math.floor(Date.now() / 1000)
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

    try {
        // A refresh sends back the plans from last time, so we skip Google.
        const sentPlans = parsePlans(body?.plans)
        const plans =
            sentPlans ??
            (await fetchGooglePlans(key, originStop, destStop, time, nowEpoch))
        if (!plans) return NextResponse.json({ journeys: [] })

        // For a later trip, look up our times from Google's first bus, not now.
        const firstBus = Math.min(
            ...plans
                .flatMap((p) => p.legs)
                .map((l) =>
                    l.type === 'bus' ? (l.departureEpoch ?? Infinity) : Infinity
                )
        )
        const fromEpoch =
            time && Number.isFinite(firstBus)
                ? Math.max(nowEpoch, firstBus - MATCH_TOLERANCE_S)
                : undefined

        const db = createPublicClient()
        const { enrich, prefetch } = createEnricher(db, nowEpoch, fromEpoch)

        const built = await Promise.all(
            plans.map(async (plan, i) => {
                // Plans can be minutes old. Count down from now.
                const planned = plan.legs.map((l) =>
                    l.type === 'bus' && l.departureEpoch != null
                        ? {
                              ...l,
                              departsIn: minutesFromNow(
                                  l.departureEpoch,
                                  nowEpoch
                              ),
                          }
                        : l
                )
                for (const leg of planned) if (leg.type === 'bus') prefetch(leg)

                // The next ride must leave after this ride arrives + walk time.
                const legs: JourneyLeg[] = []
                let readyAt: number | null = null
                for (const leg of planned) {
                    if (leg.type === 'walk') {
                        legs.push(leg)
                        if (readyAt != null) readyAt += leg.minutes * 60
                        continue
                    }
                    const ride = await enrich(leg, readyAt)
                    legs.push(ride)
                    readyAt =
                        ride.arrivalEpoch != null
                            ? ride.arrivalEpoch + TRANSFER_BUFFER_S
                            : null
                }

                const rides = legs.filter((l): l is BusLeg => l.type === 'bus')
                const firstRide = legs.findIndex((l) => l.type === 'bus')
                const lastRide = legs.findLastIndex((l) => l.type === 'bus')
                const walkMin = (from: number, to?: number) =>
                    legs.slice(from, to).reduce((sum, l) => sum + l.minutes, 0)
                const lastArrival = rides.at(-1)?.arrivalEpoch
                const arriveEpoch =
                    lastArrival != null
                        ? lastArrival + walkMin(lastRide + 1) * 60
                        : null
                const firstDeparture = rides[0]?.departureEpoch
                const leaveEpoch =
                    firstDeparture != null
                        ? firstDeparture - walkMin(0, firstRide) * 60
                        : null

                const journey: Journey = {
                    id: `route-${i}`,
                    origin: originStop,
                    destination: destStop,
                    departAt: formatClock(firstDeparture ?? null),
                    arriveAt: formatClock(arriveEpoch),
                    minutes:
                        arriveEpoch != null && leaveEpoch != null
                            ? Math.round((arriveEpoch - leaveEpoch) / 60)
                            : Math.round(plan.durationS / 60),
                    legs,
                }
                return { journey, arriveEpoch }
            })
        )

        // Earliest arrival first. Unknown times go last.
        built.sort(
            (a, b) => (a.arriveEpoch ?? Infinity) - (b.arriveEpoch ?? Infinity)
        )
        // Two options can end up on the same bus. Keep one.
        const seen = new Set<string>()
        const journeys: Journey[] = built
            .map((b) => b.journey)
            .filter((j) => {
                const rides = j.legs.filter(
                    (l): l is BusLeg => l.type === 'bus'
                )
                if (rides.some((r) => !r.tripId)) return true
                const key = rides
                    .map((r) => `${r.tripId}@${r.scheduledDepartureEpoch}`)
                    .join('|')
                return !seen.has(key) && seen.add(key)
            })

        // You can't catch a bus that has left.
        const catchable = journeys.filter((j) => {
            const first = j.legs.find((l): l is BusLeg => l.type === 'bus')
            return (
                first?.departureEpoch == null ||
                first.departureEpoch >= nowEpoch - DEPARTED_GRACE_S
            )
        })

        return NextResponse.json({
            journeys: catchable,
            plans,
            // Some options are gone. The app asks Google for new ones.
            stale: sentPlans != null && catchable.length < journeys.length,
        })
    } catch (error) {
        console.warn('[directions] failed:', (error as Error).message)
        return NextResponse.json({ journeys: [] })
    }
}
