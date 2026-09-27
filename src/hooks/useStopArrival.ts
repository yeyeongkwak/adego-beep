// Live arrivals for a single stop from /api/stop-arrival (Adelaide Metro GTFS-R).
// Countdowns shrink over time, so this refetches on an interval rather than
// relying on a long staleTime like useNearbyStops does.

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { StopArrival } from '@/types/route'

const REFETCH_INTERVAL_MS = 30_000

export const useStopArrival = (stopId: string | null) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['stop-arrival', stopId],
        queryFn: async ({ signal }): Promise<StopArrival[]> => {
            const res = await fetch(
                `/api/stop-arrival?stopId=${encodeURIComponent(stopId!)}`,
                { signal }
            )
            const data = await res.json()
            if (!res.ok)
                throw new Error(data.error ?? 'Failed to load arrivals')
            return data.arrivals ?? []
        },
        enabled: stopId != null,
        refetchInterval: REFETCH_INTERVAL_MS,
        // Keep polling while the sheet is open even if the tab is backgrounded.
        refetchIntervalInBackground: true,
        staleTime: 15_000,
        gcTime: 60_000,
        retry: 1,
        // Avoid flashing empty between the 30s refetches.
        placeholderData: keepPreviousData,
    })

    return {
        arrivals: data ?? [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
    }
}
