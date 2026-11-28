// Live bus positions for rides, polled while the map is open.

import { useQueries } from '@tanstack/react-query'
import type { BusLeg } from '@/types/journey'

export type LiveVehicle = { lat: number; lng: number; timestamp: number | null }

const POLL_MS = 15_000

export function useLiveVehicles(
    legs: BusLeg[],
    enabled = true
): (LiveVehicle | null)[] {
    const results = useQueries({
        queries: legs.map((leg) => ({
            queryKey: ['trip-map-vehicle', leg.tripId],
            queryFn: async ({
                signal,
            }: {
                signal: AbortSignal
            }): Promise<LiveVehicle | null> => {
                const res = await fetch(
                    `/api/trip-map?only=vehicle&tripId=${encodeURIComponent(leg.tripId!)}`,
                    { signal }
                )
                if (!res.ok) throw new Error(String(res.status))
                return (await res.json()).vehicle
            },
            enabled: enabled && leg.tripId != null,
            refetchInterval: POLL_MS,
            staleTime: POLL_MS,
            retry: 1,
        })),
    })
    return results.map((r) => r.data ?? null)
}
