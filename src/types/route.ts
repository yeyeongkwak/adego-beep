import { StopMode, Favourite } from '@/types/common'

export type GoogleRoute = {
    duration?: string
    legs?: { steps?: TransitStep[] }[]
}

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

// One vehicle's live position from the VehiclePositions feed.
export type VehiclePosition = {
    tripId: string
    routeId: string | null
    lat: number
    lng: number
    // How far along the trip the vehicle is; lets us count stops to a boarding
    // point. stopId is the stop it's currently at/approaching.
    currentStopSequence: number | null
    stopId: string | null
}

// Decoded + indexed vehicle snapshot, cached between requests.
export type VehicleSnapshot = {
    fetchedAt: number
    feedTimestamp: number | null
    byTripId: Map<string, VehiclePosition>
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
    // Absolute times (epoch seconds): the best-known arrival (realtime when
    // live, otherwise timetable) and the original timetable time, if known.
    arrivalEpoch: number
    scheduledEpoch: number | null
    // Minutes behind (+) / ahead (-) of timetable; null when not live or the
    // scheduled time isn't in the window.
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

// Journey planner result: walk → ride → walk, one card per option.
export type LatLng = { lat: number; lng: number }

export type RouteStop = LatLng & { name: string }

// path: the walking route (Google's polyline); empty when unknown.
export type WalkLeg = {
    type: 'walk'
    minutes: number
    to: string
    path: LatLng[]
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
    shape: LatLng[] // road-shape polyline loaded on-demand; empty before load
    minutes: number
    departsIn: number
    // Absolute departure (epoch seconds) from the boarding stop, when known.
    departureEpoch?: number | null
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
