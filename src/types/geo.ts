export type LatLng = { lat: number; lng: number }

// The map's visible rectangle, used to search for stops within the current view.
export type MapBounds = {
    north: number
    south: number
    east: number
    west: number
}
