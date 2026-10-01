import { NextRequest, NextResponse } from 'next/server'
import { PlacePrediction } from '@/types/route'

/* Places Autocomplete (New), proxied server-side so GOOGLE_MAPS_API_KEY stays
 off the client. Results are restricted to the Adelaide metro area: a
 rectangle locationRestriction plus AU region code. The client passes a
 sessionToken so a run of keystrokes + the final Details call bill as one
 session.
*/

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'

// Rough Adelaide metropolitan bounding box (SW -> NE corners).
const ADELAIDE_BOUNDS = {
    low: { latitude: -35.35, longitude: 138.44 },
    high: { latitude: -34.6, longitude: 138.75 },
}

export async function POST(request: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'Places search is not configured' },
            { status: 500 }
        )
    }

    const body = await request.json().catch(() => null)
    const inputText = typeof body?.input === 'string' ? body.input.trim() : ''
    const sessionToken =
        typeof body?.sessionToken === 'string' ? body.sessionToken : undefined
    if (!inputText) {
        return NextResponse.json({ predictions: [] })
    }

    try {
        const res = await fetch(AUTOCOMPLETE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask':
                    'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
            },
            body: JSON.stringify({
                input: inputText,
                includedRegionCodes: ['au'],
                languageCode: 'en',
                locationRestriction: { rectangle: ADELAIDE_BOUNDS },
                ...(sessionToken ? { sessionToken } : {}),
            }),
        })
        const data = await res.json()
        if (!res.ok) {
            console.warn(
                `[places/autocomplete] ${res.status}: ${data?.error?.message ?? 'unknown'}`
            )
            return NextResponse.json({ predictions: [] })
        }

        const predictions = (data.suggestions ?? [])
            .map((s: PlacePrediction) => s.placePrediction)
            .filter(
                (p: PlacePrediction['placePrediction']) =>
                    p?.placeId && p.text?.text
            )
            .map((p: NonNullable<PlacePrediction['placePrediction']>) => ({
                placeId: p.placeId as string,
                description: p.text!.text as string,
                mainText: p.structuredFormat?.mainText?.text ?? null,
                secondaryText: p.structuredFormat?.secondaryText?.text ?? null,
            }))

        return NextResponse.json({ predictions })
    } catch {
        return NextResponse.json({ predictions: [] })
    }
}
