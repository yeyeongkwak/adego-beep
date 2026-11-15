import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/* Server-side Supabase clients (API routes, server components).
A missing key is a deploy misconfiguration, so these throw rather than return
null for every caller to check.
Regenerate types after schema changes: yarn db:types
*/

function env(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const OPTIONS = { auth: { persistSession: false } }

// Publishable key: RLS applies. For public reference data (gtfs_*).
export function createPublicClient() {
    return createClient<Database>(
        env('NEXT_PUBLIC_SUPABASE_URL'),
        env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
        OPTIONS
    )
}

// Secret key: bypasses RLS. For tables the browser must not reach directly,
// e.g. saved_journeys and favourites via our API. Never import from
// client components.
export function createSecretClient() {
    return createClient<Database>(
        env('NEXT_PUBLIC_SUPABASE_URL'),
        env('SUPABASE_SECRET_KEY'),
        OPTIONS
    )
}
