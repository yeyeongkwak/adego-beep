import { requireSession } from '@/util/oauthSession'
import { NextResponse } from 'next/server'

export const GET = async () => {
    const { session, error: authError } = await requireSession()
    if (authError) return authError

    return NextResponse.json({ user: session })
}
