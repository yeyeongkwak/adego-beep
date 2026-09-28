// One realtime stop_time_update from the GTFS-R feed, indexed by stop.
export type StopArrivalUpdate = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
}

// Decoded + indexed realtime snapshot, cached between requests.
export type FeedSnapshot = {
    fetchedAt: number
    feedTimestamp: number | null
    byStopId: Map<string, StopArrivalUpdate[]>
}

// A scheduled call at a stop, resolved to an absolute epoch for the service day.
export type ScheduledCall = {
    tripId: string
    stopSequence: number | null
    arrivalEpoch: number
}

// A realtime prediction for a stop, filtered to the requested window.
export type LiveArrival = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
}

// Final shape returned to the client (timetable + realtime merged).
export type StopArrival = {
    route: string
    destination: string
    minutes: number
    live: boolean
    tripId: string
    stopSequence: number | null
    color: string | null
}

export type MergedRow = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
    live: boolean
}
