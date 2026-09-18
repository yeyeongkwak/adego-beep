export type StopMode = 'BUS' | 'TRAM' | 'RAIL'

export type NearbyStop = {
    id: string // gtfs stop_id
    code: string | null // stop_code ("18713")
    name: string // "Currie St"
    lat: number
    lng: number
    distanceM?: number // Distance from the current location, in meters — only meaningful for a location-based lookup
    mode: StopMode
}

// Based on Adelaide Metro Data
export function stopModeFromRouteType(routeType: number | null): StopMode {
    if (routeType == null) return 'BUS'
    if (
        routeType === 0 ||
        routeType === 5 ||
        (routeType >= 900 && routeType < 1000)
    ) {
        return 'TRAM'
    }
    if (
        routeType === 1 ||
        routeType === 2 ||
        (routeType >= 100 && routeType < 200) ||
        (routeType >= 400 && routeType < 500)
    ) {
        return 'RAIL'
    }
    return 'BUS'
}
