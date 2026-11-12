import { createClient } from '@supabase/supabase-js'

/* Server-side Supabase clients (API routes, server components). 
Nothing in the browser talks to Supabase directly yet; add @supabase/ssr clients with auth.
A missing key is a deploy misconfiguration, so these throw rather than return
null for every caller to check.
*/

function env(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const OPTIONS = { auth: { persistSession: false } }

// Publishable key: RLS applies. For public reference data (gtfs_*).
export function createPublicClient() {
    return createClient(
        env('NEXT_PUBLIC_SUPABASE_URL'),
        env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
        OPTIONS
    )
}

// Secret key: bypasses RLS. For tables the browser must not reach directly,
// e.g. saved_journeys. Never import from client components.
export function createSecretClient() {
    return createClient(
        env('NEXT_PUBLIC_SUPABASE_URL'),
        env('SUPABASE_SECRET_KEY'),
        OPTIONS
    )
}
