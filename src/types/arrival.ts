// One live time for one stop, from the feed.
export type StopArrivalUpdate = {
    tripId: string
    routeId: string | null
    stopId: string
    stopSequence: number | null
    arrivalEpoch: number
}

// Live feed data, saved for a short time.
export type FeedSnapshot = {
    fetchedAt: number
    feedTimestamp: number | null
    byStopId: Map<string, StopArrivalUpdate[]>
    byTripId: Map<string, StopArrivalUpdate[]>
    cancelledTrips: Set<string>
    skippedByStopId: Map<string, Set<string>>
}

// Where one vehicle is now.
export type VehiclePosition = {
    tripId: string
    routeId: string | null
    lat: number
    lng: number
    // Which stop number the vehicle is at. We use it to count stops.
    // stopId is the stop it is at or going to.
    currentStopSequence: number | null
    stopId: string | null
}

// Vehicle feed data, saved for a short time.
export type VehicleSnapshot = {
    fetchedAt: number
    feedTimestamp: number | null
    byTripId: Map<string, VehiclePosition>
}

// A timetable time at a stop, in epoch seconds.
export type ScheduledCall = {
    tripId: string
    stopSequence: number | null
    arrivalEpoch: number
}

// A live time for a stop.
// visit: a loop bus comes here two times. Is this the first or the last one?
// null if we only have this one.
export type LiveArrival = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
    visit: 'first' | 'last' | null
    started: boolean
}

// What we send to the app (timetable + live).
export type StopArrival = {
    route: string
    destination: string
    minutes: number
    live: boolean
    tripId: string
    stopSequence: number | null
    color: string | null
    // Epoch seconds. arrivalEpoch is the best time we know (live or
    // timetable). scheduledEpoch is the timetable time.
    arrivalEpoch: number
    scheduledEpoch: number | null
    // Minutes late (+) or early (-). null if not live or no timetable time.
    delayMin: number | null
    // Cancelled, or skips this stop.
    cancelled: boolean
}

export type MergedRow = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
    scheduledEpoch: number | null
    live: boolean
}
