import { NextResponse } from 'next/server'
import { SESSION_COOKIE, siteOrigin } from '@/util/oauthSession'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(SESSION_COOKIE)
    return res
}

// Link/button fallback: clear cookie and go to profile.
export async function GET() {
    const res = NextResponse.redirect(new URL('/profile', siteOrigin()))
    res.cookies.delete(SESSION_COOKIE)
    return res
}
