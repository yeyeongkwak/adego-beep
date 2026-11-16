import { requireSession } from '@/util/oauthSession'
import { NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase'
import type { Favourite, FavouriteType, StopMode } from '@/types/place'

function isFavouriteType(v: unknown): v is FavouriteType {
    return v === 'stop' || v === 'place'
}

export async function GET() {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    const { data, error } = await createSecretClient()
        .from('favorite_locations')
        .select('place_type, place_id, label, latitude, longitude, mode, code')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const favourites: Favourite[] = (data ?? []).map((item) => ({
        placeType: item.place_type as FavouriteType,
        placeId: item.place_id,
        label: item.label,
        lat: item.latitude,
        lng: item.longitude,
        ...(item.mode ? { mode: item.mode as StopMode } : {}),
        ...(item.code ? { code: item.code } : {}),
    }))

    return NextResponse.json({ favourites })
}

export async function POST(request: Request) {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    const body = await request.json()
    if (
        !isFavouriteType(body.placeType) ||
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
        .from('favorite_locations')
        .upsert(
            {
                user_id: session.userId,
                place_type: body.placeType,
                place_id: body.placeId,
                label: body.label,
                latitude: body.lat,
                longitude: body.lng,
                mode: body.mode ?? null,
                code:
                    body.placeType === 'stop' && typeof body.code === 'string'
                        ? body.code
                        : null,
            },
            {
                onConflict: 'user_id,place_type,place_id',
                ignoreDuplicates: true,
            }
        )

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    const placeId = new URL(request.url).searchParams.get('placeId')
    const placeType = new URL(request.url).searchParams.get('placeType')

    if (!placeId || !isFavouriteType(placeType)) {
        return NextResponse.json(
            { error: 'Missing or invalid placeId or placeType' },
            { status: 400 }
        )
    }

    const { error } = await createSecretClient()
        .from('favorite_locations')
        .delete()
        .eq('user_id', session.userId)
        .eq('place_id', placeId)
        .eq('place_type', placeType)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
