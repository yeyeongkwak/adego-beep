// Retrieves stops near the current coordinates from /api/stops-nearby.
// Rounds coordinates to 4 digits to stabilize the query key (prevents re-requests due to GPS vibrations).

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { NearbyStop } from '@/types/common'

export const useNearbyStops = (
    center: { lat: number; lng: number },
    radius = 600
) => {
    const lat = center ? Math.round(center.lat * 10000) / 10000 : null
    const lng = center ? Math.round(center.lng * 10000) / 10000 : null

    const { data, isLoading, error } = useQuery({
        queryKey: ['stops-nearby', lat, lng, radius],
        queryFn: async ({ signal }): Promise<NearbyStop[]> => {
            const res = await fetch(
                `/api/stops-nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
                { signal }
            )
            const data = await res.json()
            if (!res.ok)
                throw new Error(data.error ?? 'Failed to load nearby stops')
            return data.stops ?? []
        },
        enabled: lat != null && lng != null,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        //without this,`stops` briefly goes empty between the pan settling
        // and the newfetch resolving
        placeholderData: keepPreviousData,
    })

    return {
        stops: data ?? [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
    }
}
