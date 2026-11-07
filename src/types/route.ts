import { StopMode, Favourite } from '@/types/common'

export type GoogleRoute = {
    duration?: string
    legs?: { steps?: TransitStep[] }[]
}

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
}

export type MergedRow = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
    scheduledEpoch: number | null
    live: boolean
}

// Journey result: walk, ride, walk. One card for each option.
export type LatLng = { lat: number; lng: number }

export type RouteStop = LatLng & { name: string }

// polylines: walking lines from Google, one for each walk step. Empty if we
// don't know.
export type WalkLeg = {
    type: 'walk'
    minutes: number
    to: string
    polylines: string[]
}

export type BusLeg = {
    type: 'bus'
    mode: StopMode
    route: string
    color: string | null
    headsign: string
    from: string
    fromCode: string | null
    to: string
    // The GTFS trip for this ride. We use it to load stops and shape when the
    // user opens the map.
    tripId: string | null
    path: RouteStop[] // loaded later. Before that, only Google's start and end
    shape: LatLng[] // GTFS road shape, loaded with the map. Empty before
    polyline: string | null // Google's road line for this ride
    minutes: number
    departsIn: number
    // Departure time (epoch seconds), if we know it.
    departureEpoch?: number | null
    // Timetable departure. It doesn't change when the bus is late, so with
    // tripId it tells which ride this is.
    scheduledDepartureEpoch: number | null
    // Optional because old saved journeys don't have these.
    arrivalEpoch?: number | null
    arrivalLive?: boolean
    live: boolean
    delayMin: number | null // + late, - early, null if no live data
    // stopsAway is null if the vehicle is still on an earlier trip in the
    // block. Then we only show where it is.
    vehicle: (LatLng & { stopsAway: number | null; nearStop: string }) | null
}

export type JourneyLeg = WalkLeg | BusLeg

export type Journey = {
    id: string
    origin: RouteStop
    destination: RouteStop
    departAt: string
    arriveAt: string
    minutes: number
    legs: JourneyLeg[]
}

export type PlacePrediction = {
    placePrediction?: {
        placeId?: string
        text?: { text?: string }
        structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
        }
    }
}

export type TripTime = { mode: 'depart' | 'arrive'; at: Date } | null

// The point the user picked. null means nothing is picked. Current location
// also becomes a real lat/lng.
export type PickedLocation = Pick<Favourite, 'label' | 'lat' | 'lng'> | null

export type LatLngLiteral = { latitude: number; longitude: number }
export type GoogleStop = {
    name?: string
    location?: { latLng?: LatLngLiteral }
}
export type TransitStep = {
    travelMode?: string
    staticDuration?: string
    polyline?: { encodedPolyline?: string }
    transitDetails?: {
        stopDetails?: {
            arrivalStop?: GoogleStop
            departureStop?: GoogleStop
            arrivalTime?: string
            departureTime?: string
        }
        headsign?: string
        transitLine?: {
            name?: string
            nameShort?: string
            color?: string
            vehicle?: { type?: string }
        }
    }
}
