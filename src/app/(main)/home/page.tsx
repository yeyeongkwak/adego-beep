import { createClient } from '@supabase/supabase-js'
import { StatusPage } from '../../_status/status-page'
import { HomeScreen } from '@/components/home-screen'

// If the pipeline dies mid-run, `status` can get stuck on 'updating'
// forever (only the success/fail paths clear it). Ignore anything older
// than this so a crashed run doesn't wedge the banner permanently.
const STALE_AFTER_MS = 30 * 60 * 1000

async function isGtfsUpdating() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    const { data } = await supabase
        .from('gtfs_update_status')
        .select('status, started_at')
        .eq('id', 1)
        .maybeSingle()

    if (data?.status !== 'updating' || !data.started_at) return false
    return Date.now() - new Date(data.started_at).getTime() < STALE_AFTER_MS
}

export default async function HomePage() {
    if (await isGtfsUpdating()) {
        return (
            <StatusPage
                title="Updating"
                message="We're refreshing our transit data. This usually only takes a few minutes — please check back shortly."
            />
        )
    }

    return <HomeScreen />
}
