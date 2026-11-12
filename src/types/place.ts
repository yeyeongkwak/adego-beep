export type StopMode = 'BUS' | 'TRAM' | 'RAIL'

export type Stop = {
    id: string
    name: string
    code: string | null
    lat: number
    lng: number
    distanceM?: number
    mode?: StopMode
}

export type NearbyStop = {
    id: string // gtfs stop_id
    code: string | null // stop_code ('18713')
    name: string // 'Currie St'
    lat: number
    lng: number
    distanceM?: number // Distance from the current location, in meters — only meaningful for a location-based lookup
    mode: StopMode
}

export type FavouriteType = 'stop' | 'place'
export type Favourite = {
    placeType: FavouriteType
    placeId: string
    label: string
    lat: number
    lng: number
    mode?: StopMode // present for stops, used for the list icon
}

export type Recent = Favourite & {
    visitedAt: number
}

// The point the user picked. null means nothing is picked. Current location
// also becomes a real lat/lng.
export type PickedLocation = Pick<Favourite, 'label' | 'lat' | 'lng'> | null
