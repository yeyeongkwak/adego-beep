import type { LatLng } from '@/types/route'

export type Padding = {
    top: number
    left: number
    right: number
    bottom: number
}

/* The camera (centre + zoom) that frames `points` inside the padded area of a
w×h map, never zoomed in past maxZoom. Computed up front so the map moves
once — fitBounds + a zoom clamp afterwards animated in and then back out.
Web Mercator, 256px world tiles (what Google Maps uses).
*/

const TILE = 256
const worldX = (lng: number) => ((lng + 180) / 360) * TILE
const worldY = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180)
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE
}
const latOf = (y: number) =>
    ((2 * Math.atan(Math.exp((0.5 - y / TILE) * 2 * Math.PI)) - Math.PI / 2) *
        180) /
    Math.PI
const lngOf = (x: number) => (x / TILE) * 360 - 180

export function fitCamera(
    points: LatLng[],
    size: { w: number; h: number },
    padding: Padding,
    maxZoom: number
): { center: LatLng; zoom: number } {
    const xs = points.map((p) => worldX(p.lng))
    const ys = points.map((p) => worldY(p.lat))
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]

    const availW = Math.max(1, size.w - padding.left - padding.right)
    const availH = Math.max(1, size.h - padding.top - padding.bottom)
    // A single point (zero span) fits at any zoom: Infinity -> maxZoom.
    const fitScale = Math.min(availW / (maxX - minX), availH / (maxY - minY))
    const zoom = Math.max(0, Math.min(maxZoom, Math.floor(Math.log2(fitScale))))

    // Put the points' centre in the middle of the padded area, not the map:
    // shift the map centre by half the padding imbalance, in world px.
    const scale = 2 ** zoom
    const cx = (minX + maxX) / 2 - (padding.left - padding.right) / 2 / scale
    const cy = (minY + maxY) / 2 - (padding.top - padding.bottom) / 2 / scale
    return { center: { lat: latOf(cy), lng: lngOf(cx) }, zoom }
}
