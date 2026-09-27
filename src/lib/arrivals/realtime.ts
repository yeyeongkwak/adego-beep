import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import type {
    FeedSnapshot,
    LiveArrival,
    StopArrivalUpdate,
} from '@/types/route'

// Adelaide Metro GTFS-R TripUpdates: a ~240KB full snapshot the agency refreshes
// on its own cadence, carrying live predicted times for currently-tracked trips.

const FEED_URL =
    process.env.GTFS_RT_TRIP_UPDATES_URL ??
    'https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates'

// One download serves every request for a short window.
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

    // Feed is per-trip; index by stop so a lookup is one map hit.
    const byStopId = new Map<string, StopArrivalUpdate[]>()
    for (const entity of feed.entity) {
        const tripUpdate = entity.tripUpdate
        const tripId = tripUpdate?.trip?.tripId
        if (!tripUpdate || !tripId) continue
        for (const update of tripUpdate.stopTimeUpdate ?? []) {
            const stopId = update.stopId
            const arrivalEpoch = toNumber(update.arrival?.time)
            if (!stopId || arrivalEpoch == null) continue
            const entry: StopArrivalUpdate = {
                tripId,
                routeId: tripUpdate.trip?.routeId ?? null,
                stopSequence: update.stopSequence ?? null,
                arrivalEpoch,
            }
            const list = byStopId.get(stopId)
            if (list) list.push(entry)
            else byStopId.set(stopId, [entry])
        }
    }

    return {
        fetchedAt: Date.now(),
        feedTimestamp: toNumber(feed.header?.timestamp),
        byStopId,
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
        .map((u) => ({
            tripId: u.tripId,
            routeId: u.routeId,
            stopSequence: u.stopSequence,
            arrivalEpoch: u.arrivalEpoch,
        }))

    return { arrivals, feedTimestamp: snapshot.feedTimestamp }
}
