import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import type {
    FeedSnapshot,
    LiveArrival,
    StopArrivalUpdate,
    VehiclePosition,
    VehicleSnapshot,
} from '@/types/route'

// Adelaide Metro live trip updates. One big file (~240KB) for all buses.

const FEED_URL =
    process.env.GTFS_RT_TRIP_UPDATES_URL ??
    'https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates'

const FEED_TTL_MS = 20_000

function toNumber(value: unknown): number | null {
    if (value == null) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    if (typeof value === 'object' && 'toNumber' in value) {
        return (value as { toNumber: () => number }).toNumber()
    }
    return null
}

let cached: FeedSnapshot | null = null
let inFlight: Promise<FeedSnapshot> | null = null

async function loadFeed(): Promise<FeedSnapshot> {
    const res = await fetch(FEED_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`TripUpdates feed responded ${res.status}`)

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(await res.arrayBuffer())
    )

    const byStopId = new Map<string, StopArrivalUpdate[]>()
    const byTripId = new Map<string, StopArrivalUpdate[]>()
    for (const entity of feed.entity) {
        const tripUpdate = entity.tripUpdate
        const tripId = tripUpdate?.trip?.tripId
        if (!tripUpdate || !tripId) continue
        const tripUpdates: StopArrivalUpdate[] = []
        for (const update of tripUpdate.stopTimeUpdate ?? []) {
            const stopId = update.stopId
            const arrivalEpoch = toNumber(update.arrival?.time)
            if (!stopId || arrivalEpoch == null) continue
            const entry: StopArrivalUpdate = {
                tripId,
                routeId: tripUpdate.trip?.routeId ?? null,
                stopId,
                stopSequence: update.stopSequence ?? null,
                arrivalEpoch,
            }
            tripUpdates.push(entry)
            const list = byStopId.get(stopId)
            if (list) list.push(entry)
            else byStopId.set(stopId, [entry])
        }
        byTripId.set(tripId, tripUpdates)
    }

    return {
        fetchedAt: Date.now(),
        feedTimestamp: toNumber(feed.header?.timestamp),
        byStopId,
        byTripId,
    }
}

export async function getFeedSnapshot(): Promise<FeedSnapshot> {
    if (cached && Date.now() - cached.fetchedAt < FEED_TTL_MS) return cached
    if (inFlight) return inFlight
    inFlight = loadFeed()
        .then((snapshot) => {
            cached = snapshot
            return snapshot
        })
        .catch((error) => {
            if (cached) return cached
            throw error
        })
        .finally(() => {
            inFlight = null
        })
    return inFlight
}

export type LiveArrivalsResult = {
    arrivals: LiveArrival[]
    feedTimestamp: number | null
}

export async function getLiveArrivals(
    stopId: string,
    lowerEpoch: number,
    windowEndEpoch: number
): Promise<LiveArrivalsResult> {
    let snapshot: FeedSnapshot | null = null
    try {
        snapshot = await getFeedSnapshot()
    } catch {
        return { arrivals: [], feedTimestamp: null }
    }

    const arrivals = (snapshot.byStopId.get(stopId) ?? [])
        .filter(
            (u) =>
                u.arrivalEpoch >= lowerEpoch && u.arrivalEpoch <= windowEndEpoch
        )
        .map((u): LiveArrival => {
            const others = (snapshot.byTripId.get(u.tripId) ?? []).filter(
                (o) => o.stopId !== u.stopId
            )
            return {
                tripId: u.tripId,
                routeId: u.routeId,
                stopSequence: u.stopSequence,
                arrivalEpoch: u.arrivalEpoch,
                visit: others.some((o) => o.arrivalEpoch > u.arrivalEpoch)
                    ? 'first'
                    : others.length > 0
                      ? 'last'
                      : null,
            }
        })

    return { arrivals, feedTimestamp: snapshot.feedTimestamp }
}

// Usually only the next few stops.
export async function getTripUpdates(
    tripId: string
): Promise<StopArrivalUpdate[]> {
    try {
        return (await getFeedSnapshot()).byTripId.get(tripId) ?? []
    } catch {
        return []
    }
}

// --- VehiclePositions (works the same way as above) ------------------------

const VEHICLE_FEED_URL =
    process.env.GTFS_RT_VEHICLE_POSITIONS_URL ??
    'https://gtfs.adelaidemetro.com.au/v1/realtime/vehicle_positions'

const VEHICLE_TTL_MS = 20_000

let vehicleCache: VehicleSnapshot | null = null
let vehicleInFlight: Promise<VehicleSnapshot> | null = null

async function loadVehicleFeed(): Promise<VehicleSnapshot> {
    const res = await fetch(VEHICLE_FEED_URL, { cache: 'no-store' })
    if (!res.ok)
        throw new Error(`VehiclePositions feed responded ${res.status}`)

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(await res.arrayBuffer())
    )

    const byTripId = new Map<string, VehiclePosition>()
    for (const entity of feed.entity) {
        const v = entity.vehicle
        const tripId = v?.trip?.tripId
        const lat = v?.position?.latitude
        const lng = v?.position?.longitude
        if (!v || !tripId || lat == null || lng == null) continue
        byTripId.set(tripId, {
            tripId,
            routeId: v.trip?.routeId ?? null,
            lat,
            lng,
            currentStopSequence: v.currentStopSequence ?? null,
            stopId: v.stopId ?? null,
        })
    }

    return {
        fetchedAt: Date.now(),
        feedTimestamp: toNumber(feed.header?.timestamp),
        byTripId,
    }
}

export async function getVehicleSnapshot(): Promise<VehicleSnapshot> {
    if (vehicleCache && Date.now() - vehicleCache.fetchedAt < VEHICLE_TTL_MS)
        return vehicleCache
    if (vehicleInFlight) return vehicleInFlight
    vehicleInFlight = loadVehicleFeed()
        .then((snapshot) => {
            vehicleCache = snapshot
            return snapshot
        })
        .catch((error) => {
            if (vehicleCache) return vehicleCache
            throw error
        })
        .finally(() => {
            vehicleInFlight = null
        })
    return vehicleInFlight
}

// A vehicle only says its current trip, so we check every trip in the block.
export async function findVehicleForTrips(
    tripIds: string[]
): Promise<VehiclePosition | null> {
    let snapshot: VehicleSnapshot
    try {
        snapshot = await getVehicleSnapshot()
    } catch {
        return null
    }
    for (const tripId of tripIds) {
        const v = snapshot.byTripId.get(tripId)
        if (v) return v
    }
    return null
}
