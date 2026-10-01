import { NextRequest, NextResponse } from 'next/server'

// Reverse-geocode a coordinate to a human label via Google Geocoding
// Returns a street address ("100 King William St, Adelaide")

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function GET(request: NextRequest) {
    const lat = Number(request.nextUrl.searchParams.get('lat'))
    const lng = Number(request.nextUrl.searchParams.get('lng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json(
            { error: 'lat and lng are required' },
            { status: 400 }
        )
    }

    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'Geocoding is not configured' },
            { status: 500 }
        )
    }

    try {
        const url = `${GEOCODE_URL}?latlng=${lat},${lng}&language=en&key=${key}`
        const res = await fetch(url)
        const data = await res.json()

        /* status distinguishes "no address here" (ZERO_RESULTS) from config
         problems (REQUEST_DENIED = bad/unauthorised key, OVER_QUERY_LIMIT =
         quota). Only OK carries usable results; surface the rest in logs so a
         silent null isn't mistaken for "nowhere near an address".
        */
        if (data.status !== 'OK') {
            if (data.status !== 'ZERO_RESULTS') {
                console.warn(
                    `[reverse-geocode] ${data.status}: ${data.error_message ?? 'no detail'}`
                )
            }
            return NextResponse.json({ label: null })
        }

        const results: Array<{
            formatted_address?: string
            types?: string[]
        }> = data.results ?? []
        const streetAddress = results.find((r) =>
            r.types?.includes('street_address')
        )
        const label =
            streetAddress?.formatted_address ??
            results[0]?.formatted_address ??
            null

        return NextResponse.json({ label })
    } catch {
        return NextResponse.json({ label: null })
    }
}
