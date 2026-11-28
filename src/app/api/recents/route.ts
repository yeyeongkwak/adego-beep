import { requireSession } from '@/util/oauthSession'
import { NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase'
import type { FavouriteType, Recent, StopMode } from '@/types/place'
import { MAX_RECENTS } from '@/util/recent'

function isPlaceType(v: unknown): v is FavouriteType {
    return v === 'stop' || v === 'place'
}

export async function GET() {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    // ponytail: older rows are never deleted, only not read. Trim in the
    // POST if the table ever gets big.
    const { data, error } = await createSecretClient()
        .from('recent_places')
        .select(
            'place_type, place_id, label, latitude, longitude, mode, code, visited_at'
        )
        .eq('user_id', session.userId)
        .order('visited_at', { ascending: false })
        .limit(MAX_RECENTS)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const recents: Recent[] = (data ?? []).map((item) => ({
        placeType: item.place_type as FavouriteType,
        placeId: item.place_id,
        label: item.label,
        lat: item.latitude,
        lng: item.longitude,
        ...(item.mode ? { mode: item.mode as StopMode } : {}),
        ...(item.code ? { code: item.code } : {}),
        visitedAt: Date.parse(item.visited_at),
    }))

    return NextResponse.json({ recents })
}

export async function POST(request: Request) {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    const body = await request.json()
    if (
        !isPlaceType(body.placeType) ||
        typeof body.placeId !== 'string' ||
        !body.placeId ||
        typeof body.label !== 'string' ||
        !body.label ||
        !Number.isFinite(body.lat) ||
        !Number.isFinite(body.lng)
    ) {
        return NextResponse.json(
            { error: 'Missing or invalid fields' },
            { status: 400 }
        )
    }

    const { error } = await createSecretClient()
        .from('recent_places')
        .upsert(
            {
                user_id: session.userId,
                place_type: body.placeType,
                place_id: body.placeId,
                label: body.label,
                latitude: body.lat,
                longitude: body.lng,
                mode: typeof body.mode === 'string' ? body.mode : null,
                code: typeof body.code === 'string' ? body.code : null,
                visited_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,place_type,place_id' }
        )

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
}
