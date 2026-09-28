'use client'

import { useEffect, useState } from 'react'
import { HomeMap } from '@/components/page/home/home-map'
import {
    HomeSheet,
    PREVIEW_SNAP_POINT,
} from '@/components/page/home/home-sheet'
import { useNearbyStops } from '@/hooks/useNearbyStops'
import type { MapBounds, Stop } from '@/types/common'

// Adelaide CBD — fallback center when location is denied/unavailable.
const ADELAIDE_CENTER = { lat: -34.9285, lng: 138.6007 }

export function HomeScreen() {
    const [snapPoint, setSnapPoint] = useState<number | string | null>(
        PREVIEW_SNAP_POINT
    )
    const collapsed = snapPoint === 0
    const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
        null
    )
    const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null)
    const [userLocation, setUserLocation] = useState<{
        lat: number
        lng: number
    } | null>(null)

    const { stops: nearbyStops } = useNearbyStops(searchBounds)

    const [selectedStop, setSelectedStop] = useState<Stop | null>(null)

    const handleSelectStop = (stop: Stop | null) => {
        setSelectedStop(stop)
        setSnapPoint((current) =>
            current === 0 ? PREVIEW_SNAP_POINT : current
        )
    }

    const [locationDenied, setLocationDenied] = useState(false)

    const requestLocation = () => {
        if (!('geolocation' in navigator)) {
            queueMicrotask(() => {
                setCenter(ADELAIDE_CENTER)
            })
            return
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocationDenied(false)
                const coords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }
                setUserLocation(coords)
                setCenter(coords)
            },
            (err) => {
                // 1=PERMISSION_DENIED 2=POSITION_UNAVAILABLE 3=TIMEOUT
                console.warn(
                    `[geolocation] falling back to Adelaide (code ${err.code}): ${err.message}`
                )
                setLocationDenied(err.code === err.PERMISSION_DENIED)
                setCenter((c) => c ?? ADELAIDE_CENTER)
            },
            { enableHighAccuracy: false, timeout: 15000 }
        )
    }

    useEffect(requestLocation, [])

    return (
        <div className="relative h-dvh w-full overflow-hidden">
            {center ? (
                <HomeMap
                    key={userLocation ? 'gps' : 'fallback'}
                    center={center}
                    userLocation={userLocation}
                    nearbyStops={nearbyStops}
                    selectedStop={selectedStop}
                    onSelectStop={handleSelectStop}
                    onBoundsChange={setSearchBounds}
                    sheetFraction={
                        typeof snapPoint === 'number' ? snapPoint : 0
                    }
                />
            ) : (
                <div className="map-skeleton relative h-full w-full" />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-start gap-2 p-4">
                <span className="pointer-events-auto inline-block rounded-full bg-primary px-4 py-2 text-lg font-extrabold text-white shadow-lg">
                    Adelaide Go Beep
                </span>
                {locationDenied && (
                    <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white px-4 py-2 text-sm shadow-lg dark:bg-zinc-800">
                        <span>
                            Location access is off. Enable it in your device
                            settings.
                        </span>
                        <button
                            type="button"
                            onClick={requestLocation}
                            className="min-h-11 shrink-0 font-semibold text-primary"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>

            <HomeSheet
                activeSnapPoint={snapPoint}
                onSnapPointChange={setSnapPoint}
                nearbyStops={nearbyStops}
                selectedStop={selectedStop}
                onSelectStop={handleSelectStop}
            />

            {collapsed && (
                <button
                    type="button"
                    onClick={() => setSnapPoint(PREVIEW_SNAP_POINT)}
                    className="absolute bottom-6 left-1/2 z-30 min-h-11 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-xl transition-transform active:scale-95"
                >
                    Where to?
                </button>
            )}
        </div>
    )
}
