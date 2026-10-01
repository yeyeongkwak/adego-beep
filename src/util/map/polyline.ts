import type { LatLng } from '@/types/route'

// Google's encoded polyline format -> points.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded: string): LatLng[] {
    const points: LatLng[] = []
    let i = 0
    let lat = 0
    let lng = 0
    const next = () => {
        let result = 0
        let shift = 0
        let b: number
        do {
            b = encoded.charCodeAt(i++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        return result & 1 ? ~(result >> 1) : result >> 1
    }
    while (i < encoded.length) {
        lat += next()
        lng += next()
        points.push({ lat: lat / 1e5, lng: lng / 1e5 })
    }
    return points
}
