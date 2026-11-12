import type { LatLng } from '@/types/geo'
import type { StopMode } from '@/types/place'

// Journey result: walk, ride, walk. One card for each option.
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

export type TripTime = { mode: 'depart' | 'arrive'; at: Date } | null
