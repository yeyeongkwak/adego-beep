import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import type { AppSession } from '@/types/auth'

export const SESSION_COOKIE = 'app_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function siteOrigin() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function sessionSecret() {
    const secret = process.env.SESSION_SECRET
    if (!secret) throw new Error('SESSION_SECRET is not set')
    return new TextEncoder().encode(secret)
}

export async function signAppSession(session: AppSession): Promise<string> {
    return new SignJWT({
        userId: session.userId,
        email: session.email,
        name: session.name ?? undefined,
        picture: session.picture ?? undefined,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_MAX_AGE}s`)
        .sign(sessionSecret())
}

export async function getAppSession(): Promise<AppSession | null> {
    const raw = (await cookies()).get(SESSION_COOKIE)?.value
    if (!raw || !process.env.SESSION_SECRET) return null
    try {
        const { payload } = await jwtVerify(raw, sessionSecret())
        const claims = payload as Record<string, unknown>
        const userId = claims.userId
        const email = claims.email
        if (typeof userId !== 'string' || !userId) return null
        if (typeof email !== 'string' || !email) return null
        return {
            userId,
            email,
            name: typeof claims.name === 'string' ? claims.name : null,
            picture: typeof claims.picture === 'string' ? claims.picture : null,
        }
    } catch {
        // Bad signature, expired, or tampered cookie.
        return null
    }
}

// For API routes. Callers return `error` when present.
export async function requireSession(): Promise<
    | { session: AppSession; error: null }
    | { session: null; error: NextResponse }
> {
    const session = await getAppSession()
    if (!session) {
        return {
            session: null,
            error: NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            ),
        }
    }
    return { session, error: null }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge,
    }
}
