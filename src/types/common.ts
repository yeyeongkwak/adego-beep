import { BusFront, TrainFront, TramFront } from 'lucide-react'

export type StopMode = 'BUS' | 'TRAM' | 'RAIL'

// The map's visible rectangle, used to search for stops within the current view.
export type MapBounds = {
    north: number
    south: number
    east: number
    west: number
}

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

export const STOP_MODE_STYLE: Record<
    StopMode,
    { icon: typeof BusFront; iconClass: string; bgClass: string }
> = {
    BUS: {
        icon: BusFront,
        iconClass: 'text-primary',
        bgClass: 'bg-primary/10',
    },
    TRAM: {
        icon: TramFront,
        iconClass: 'text-accent',
        bgClass: 'bg-accent/10',
    },
    RAIL: { icon: TrainFront, iconClass: 'text-alert', bgClass: 'bg-alert/10' },
}
