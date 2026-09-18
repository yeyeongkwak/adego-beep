import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Haversine — fine at "nearby stop" city-block scale, no need for PostGIS.
export function distanceMeters(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
) {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) *
            Math.cos(toRad(b.lat)) *
            Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
}
