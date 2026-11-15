import { NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import {
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    sessionCookieOptions,
    signAppSession,
    siteOrigin,
} from '@/util/oauthSession'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const origin = siteOrigin()

    if (error) {
        return NextResponse.redirect(new URL('/profile?error=oauth', origin))
    }

    const cookieStore = await cookies()
    const saved = cookieStore.get('oauth_state')?.value
    if (!code || !state || state !== saved) {
        return NextResponse.redirect(new URL('/profile?error=state', origin))
    }

    const redirectUri = `${origin}/api/auth/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    })
    if (!tokenRes.ok) {
        return NextResponse.redirect(new URL('/profile?error=token', origin))
    }

    const tokens = (await tokenRes.json()) as { access_token?: string }
    if (!tokens.access_token) {
        return NextResponse.redirect(new URL('/profile?error=token', origin))
    }

    const userRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    if (!userRes.ok) {
        return NextResponse.redirect(new URL('/profile?error=userinfo', origin))
    }

    const profile = (await userRes.json()) as {
        email?: string
        name?: string
        picture?: string
    }
    if (!profile.email) {
        return NextResponse.redirect(new URL('/profile?error=userinfo', origin))
    }

    const supabase = createSecretClient()
    const { data: existing } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', profile.email)
        .maybeSingle()

    const userId: string = existing?.id ?? crypto.randomUUID()
    if (!existing) {
        const { error: insertError } = await supabase.from('app_users').insert({
            id: userId,
            email: profile.email,
            name: profile.name ?? null,
            picture: profile.picture ?? null,
        })
        if (insertError) {
            console.error(
                '[auth/callback] app_users insert failed',
                insertError
            )
            return NextResponse.redirect(
                new URL('/profile?error=insert', origin)
            )
        }
    } else {
        await supabase
            .from('app_users')
            .update({
                name: profile.name ?? null,
                picture: profile.picture ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
    }

    const jwt = await signAppSession({
        userId,
        email: profile.email,
        name: profile.name ?? null,
        picture: profile.picture ?? null,
    })

    const res = NextResponse.redirect(new URL('/home', origin))
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions(SESSION_MAX_AGE))
    res.cookies.delete('oauth_state')
    return res
}
