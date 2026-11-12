/* Client helper for the /api/reverse-geocode route. Returns a street-address
label for a coordinate, or null if unavailable
*/
export async function fetchLocationLabel(
    lat: number,
    lng: number
): Promise<string | null> {
    try {
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
        if (!res.ok) return null
        const data = await res.json()
        return typeof data.label === 'string' ? data.label : null
    } catch {
        return null
    }
}
