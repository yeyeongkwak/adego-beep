type Point = { lat: number; lng: number }

const EARTH_RADIUS_M = 6371000

export function distanceMeters(a: Point, b: Point): number {
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) *
            Math.cos(toRad(b.lat)) *
            Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export const haversineKm = (a: Point, b: Point) => distanceMeters(a, b) / 1000

export function formatDistance(metres: number): string {
    return metres < 1000 ? `${metres}m` : `${(metres / 1000).toFixed(1)}km`
}

/** Rough lat/lng box around a point — used to start Nearby before the map
 *  reports real bounds (avoids a cold-start Loading hang). */
export function boundsAround(
    center: Point,
    radiusM: number
): { north: number; south: number; east: number; west: number } {
    const lat = radiusM / 111_320
    const lng =
        radiusM /
        (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)))
    return {
        north: center.lat + lat,
        south: center.lat - lat,
        east: center.lng + lng,
        west: center.lng - lng,
    }
}
