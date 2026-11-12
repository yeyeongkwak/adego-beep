// Live status of the buses in a saved journey. No Google call, so it's free.

import { useQueries } from '@tanstack/react-query'
import type { BusLeg } from '@/types/journey'
import type { StopArrival } from '@/types/arrival'

const REFETCH_INTERVAL_MS = 30_000

// Only rides we matched to GTFS have a stopId.
const boardingStopId = (leg: BusLeg) =>
    (leg.path[0] as { stopId?: string } | undefined)?.stopId ?? null

export function useRideStatuses(legs: BusLeg[]): (StopArrival | null)[] {
    const results = useQueries({
        queries: legs.map((leg) => {
            const stopId = boardingStopId(leg)
            return {
                queryKey: ['ride-status', stopId],
                queryFn: async ({
                    signal,
                }: {
                    signal: AbortSignal
                }): Promise<StopArrival[]> => {
                    const res = await fetch(
                        `/api/stop-arrival?stopId=${encodeURIComponent(stopId!)}&limit=80&windowMinutes=180`,
                        { signal }
                    )
                    if (!res.ok) throw new Error(String(res.status))
                    return (await res.json()).arrivals ?? []
                },
                enabled: stopId != null && leg.tripId != null,
                refetchInterval: REFETCH_INTERVAL_MS,
                refetchIntervalInBackground: true,
                staleTime: 15_000,
                retry: 1,
            }
        }),
    })
    // Trip ids repeat every day, so check the time too.
    return legs.map(
        (leg, i) =>
            results[i].data?.find(
                (a) =>
                    a.tripId === leg.tripId &&
                    a.scheduledEpoch === leg.scheduledDepartureEpoch
            ) ?? null
    )
}
