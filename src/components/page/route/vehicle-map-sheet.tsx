'use client'

/* Full-screen sheet showing ONE ride leg on the map with its live vehicle.
 Opened from a JourneyCard's GPS button.

 Two react-query queries per open:
   1. static  — stops + road-shape (staleTime: Infinity, fetched once per tripId)
   2. vehicle — live position       (refetchInterval: 30s, keeps the pin moving)
*/

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import type { BusLeg, Journey, LatLng, RouteStop } from '@/types/route'
import { RouteMap } from './route-map'

type VehicleOut = {
    lat: number
    lng: number
    tripId: string
    currentStopSequence: number | null
} | null

type TripMapResponse = {
    stops: RouteStop[]
    shape: LatLng[]
    vehicle: VehicleOut
}

const VEHICLE_POLL_MS = 30_000

async function fetchTripMap(tripId: string): Promise<TripMapResponse> {
    const res = await fetch(
        `/api/trip-map?tripId=${encodeURIComponent(tripId)}`
    )
    if (!res.ok) throw new Error('trip-map fetch failed')
    return res.json()
}

export function VehicleMapSheet({
    open,
    onOpenChange,
    leg,
    userLocation = null,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    leg: BusLeg | null
    userLocation?: { lat: number; lng: number } | null
}) {
    const tripId = leg?.tripId ?? null

    // Static data: stops + shape. Fetched once per tripId, never expires.
    const { data: staticData, isLoading: staticLoading } =
        useQuery<TripMapResponse>({
            queryKey: ['trip-map-static', tripId],
            queryFn: () => fetchTripMap(tripId!),
            enabled: open && tripId != null,
            staleTime: Infinity,
            gcTime: 10 * 60 * 1000, // keep in cache 10 min after unmount
        })

    // Live vehicle position, re-polled every 30 s while the sheet is open.
    const { data: vehicleData } = useQuery<TripMapResponse, Error, VehicleOut>({
        queryKey: ['trip-map-vehicle', tripId],
        queryFn: () => fetchTripMap(tripId!),
        enabled: open && tripId != null,
        staleTime: VEHICLE_POLL_MS,
        refetchInterval: VEHICLE_POLL_MS,
        select: (d) => d.vehicle,
    })

    const stops = staticData?.stops ?? []
    const shape = staticData?.shape ?? []
    // Prefer the freshly-polled vehicle; fall back to what came with the leg.
    const liveVehicle = vehicleData ?? leg?.vehicle ?? null

    const enrichedLeg: BusLeg | null = leg
        ? {
              ...leg,
              path: stops.length > 0 ? stops : leg.path,
              shape,
              vehicle: liveVehicle
                  ? {
                        lat: liveVehicle.lat,
                        lng: liveVehicle.lng,
                        stopsAway: leg.vehicle?.stopsAway ?? null,
                        nearStop: leg.vehicle?.nearStop ?? '',
                    }
                  : leg.vehicle,
          }
        : null

    const journey: Journey | null = enrichedLeg
        ? {
              id: 'leg-map',
              origin: (enrichedLeg.path[0] ?? {
                  name: enrichedLeg.from,
                  lat: 0,
                  lng: 0,
              }) as RouteStop,
              destination: (enrichedLeg.path[enrichedLeg.path.length - 1] ?? {
                  name: enrichedLeg.to,
                  lat: 0,
                  lng: 0,
              }) as RouteStop,
              departAt: '',
              arriveAt: '',
              minutes: enrichedLeg.minutes,
              legs: [enrichedLeg],
          }
        : null

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            {/* z-[70]: above the fixed nav footer (z-[60]) */}
            <DrawerContent
                showHandle={false}
                className="z-[70] mx-auto h-full max-w-md rounded-none border-0"
            >
                <DrawerTitle className="sr-only">
                    Live vehicle location
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                    This bus shown live on the map
                </DrawerDescription>

                <div className="relative min-h-0 flex-1">
                    {staticLoading ? (
                        <div className="map-skeleton h-full w-full" />
                    ) : (
                        journey && (
                            <RouteMap
                                journey={journey}
                                userLocation={userLocation}
                                showEndpoints={false}
                            />
                        )
                    )}
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => onOpenChange(false)}
                        className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white text-primary shadow-lg hover:bg-white dark:bg-zinc-800 dark:text-zinc-100"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
