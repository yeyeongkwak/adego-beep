import { NextResponse } from 'next/server'
import { siteOrigin } from '@/util/oauthSession'

export async function GET() {
    if (!process.env.GOOGLE_CLIENT_ID) {
        return NextResponse.json(
            { error: 'GOOGLE_CLIENT_ID is not set' },
            { status: 500 }
        )
    }

    const state = crypto.randomUUID()
    const origin = siteOrigin()
    const redirectUri = `${origin}/api/auth/callback`
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', state)

    const res = NextResponse.redirect(url)
    res.cookies.set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
    })
    return res
}
