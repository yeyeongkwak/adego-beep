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
    // The GTFS trip this ride matched — used to fetch stops/shape on demand
    // when the user opens the vehicle map (see /api/trip-map).
    tripId: string | null
    path: RouteStop[] // stops loaded on-demand; before load: Google's 2-point boarding→alighting
    shape: LatLng[] // GTFS road shape, filled on demand (vehicle map); else empty
    polyline: string | null // Google's encoded road line for just this ride
    minutes: number
    departsIn: number
    // Absolute departure (epoch seconds) from the boarding stop, when known.
    departureEpoch?: number | null
    // Timetable departure: unlike departureEpoch it doesn't move with live
    // delays, so it (with tripId) identifies this exact ride.
    scheduledDepartureEpoch: number | null
    live: boolean
    delayMin: number | null // + late, - early, null when schedule-only
    // stopsAway is null when the vehicle is still on an earlier block trip
    // (per-trip stop_sequence isn't comparable) — show the live position only.
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

// A chosen point for a route endpoint. null means "nothing selected".
// Current location resolves to a real coord (label 'Current location').
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
