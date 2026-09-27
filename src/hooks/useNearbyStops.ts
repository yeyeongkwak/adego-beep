// Retrieves stops inside the map's visible bounds from /api/stops-nearby.
// Rounds bounds to 4 digits to stabilize the query key (prevents re-requests
// from sub-metre jitter while panning).

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { MapBounds, NearbyStop } from '@/types/common'

const round4 = (n: number) => Math.round(n * 10000) / 10000

export const useNearbyStops = (bounds: MapBounds | null) => {
    const north = bounds ? round4(bounds.north) : null
    const south = bounds ? round4(bounds.south) : null
    const east = bounds ? round4(bounds.east) : null
    const west = bounds ? round4(bounds.west) : null

    const { data, isLoading, error } = useQuery({
        queryKey: ['stops-nearby', north, south, east, west],
        queryFn: async ({ signal }): Promise<NearbyStop[]> => {
            const params = new URLSearchParams({
                north: String(north),
                south: String(south),
                east: String(east),
                west: String(west),
            })
            const res = await fetch(`/api/stops-nearby?${params}`, { signal })
            const data = await res.json()
            if (!res.ok)
                throw new Error(data.error ?? 'Failed to load nearby stops')
            return data.stops ?? []
        },
        enabled: north != null && south != null && east != null && west != null,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        // Without this, `stops` briefly goes empty between the pan settling
        // and the new fetch resolving.
        placeholderData: keepPreviousData,
    })

    return {
        stops: data ?? [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
    }
}
