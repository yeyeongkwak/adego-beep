const EARTH_RADIUS_M = 6371000

export function distanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.asin(Math.sqrt(a))
    return EARTH_RADIUS_M * c
}

export function formatDistance(metres: number): string {
    return metres < 1000 ? `${metres}m` : `${(metres / 1000).toFixed(1)}km`
}

export function haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
) {
    const R = 6371
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}
