import { NextRequest, NextResponse } from 'next/server'

/* Place Details, proxied server-side.
 Resolves a placeId (from an autocomplete prediction) to coordinates and a display label.
 The sessionToken must match the one used for the autocomplete calls
 so Google bills the whole interaction as a single session.
*/

const DETAILS_URL = 'https://places.googleapis.com/v1/places'

export async function GET(request: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'Places search is not configured' },
            { status: 500 }
        )
    }

    const placeId = request.nextUrl.searchParams.get('placeId')?.trim()
    const sessionToken = request.nextUrl.searchParams.get('sessionToken') ?? ''
    if (!placeId) {
        return NextResponse.json(
            { error: 'placeId is required' },
            { status: 400 }
        )
    }

    try {
        const url = new URL(`${DETAILS_URL}/${placeId}`)
        if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

        const res = await fetch(url, {
            headers: {
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': 'location,displayName,formattedAddress',
            },
        })
        const data = await res.json()
        if (!res.ok || !data.location) {
            console.warn(
                `[places/details] ${res.status}: ${data?.error?.message ?? 'no location'}`
            )
            return NextResponse.json(
                { error: 'Could not resolve place' },
                { status: 502 }
            )
        }

        return NextResponse.json({
            label:
                data.displayName?.text ??
                data.formattedAddress ??
                'Selected place',
            lat: data.location.latitude,
            lng: data.location.longitude,
        })
    } catch {
        return NextResponse.json(
            { error: 'Could not resolve place' },
            { status: 502 }
        )
    }
}
