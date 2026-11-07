import { notFound } from 'next/navigation'
import { RouteDetail } from '@/components/page/route/route-detail'
import { loadSavedJourney } from '@/lib/savedJourneys'

// Read straight from the DB on the server: the page arrives ready (no
// loading spinner) and the secret key never leaves the server.
export default async function RouteDetailPage({
    params,
}: {
    params: Promise<{ route_id: string }>
}) {
    const { route_id } = await params
    const journey = await loadSavedJourney(route_id)
    if (!journey) notFound()
    return <RouteDetail journey={journey} />
}
