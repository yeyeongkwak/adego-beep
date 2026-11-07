import { createSecretClient } from '@/lib/supabase'
import type { Journey } from '@/types/route'

// Matches what journeyId() produces; anything else can't be a row.
const ID_RE = /^[A-Za-z0-9_-]{16}$/

/* One saved journey by id, or null if unknown / cleaned up. Opening bumps
last_viewed_at (in the same round trip) so links people still use survive a
future "unopened for 90 days" cleanup. Server-only (secret key).
*/
export async function loadSavedJourney(id: string): Promise<Journey | null> {
    if (!ID_RE.test(id)) return null
    const { data, error } = await createSecretClient()
        .from('saved_journeys')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', id)
        .select('journey')
        .maybeSingle()
    if (error) throw new Error(error.message)
    return (data?.journey as Journey | undefined) ?? null
}
