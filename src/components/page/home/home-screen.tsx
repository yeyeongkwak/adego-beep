'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HomeMap } from '@/components/page/home/home-map'
import {
    HomeSheet,
    PREVIEW_SNAP_POINT,
} from '@/components/page/home/home-sheet'
import { useNearbyStops } from '@/hooks/useNearbyStops'
import { useRecent } from '@/hooks/useRecent'
import type { MapBounds } from '@/types/geo'
import type { Stop } from '@/types/place'
import { boundsAround, distanceMeters } from '@/util/map/distance'

// Adelaide CBD — fallback center when location is denied/unavailable.
const ADELAIDE_CENTER = { lat: -34.9285, lng: 138.6007 }

// Seed Nearby before the map reports real bounds (GPS zoom ≈ tight box).
const seedBounds = (at: { lat: number; lng: number }, gps: boolean) =>
    boundsAround(at, gps ? 500 : 1500)

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

    const { stops: nearbyStops, loading: nearbyLoading } =
        useNearbyStops(searchBounds)

    const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
    const { record } = useRecent()

    const handleSelectStop = (stop: Stop | null) => {
        if (!stop) {
            setSelectedStop(null)
            return
        }
        // Favourites omit code/distance; fill from nearby list or live GPS.
        const nearby = nearbyStops.find((s) => s.id === stop.id)
        const distanceM =
            stop.distanceM ??
            nearby?.distanceM ??
            (userLocation
                ? Math.round(
                      distanceMeters(userLocation, {
                          lat: stop.lat,
                          lng: stop.lng,
                      })
                  )
                : undefined)
        const code = stop.code ?? nearby?.code ?? null
        setSelectedStop({ ...stop, code, distanceM })
        record({
            placeType: 'stop',
            placeId: stop.id,
            label: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            mode: stop.mode,
            code,
        })
        setSnapPoint((current) =>
            current === 0 ? PREVIEW_SNAP_POINT : current
        )
    }

    const [locationDenied, setLocationDenied] = useState(false)
    const [locationRetrying, setLocationRetrying] = useState(false)
    // Site was denied before; OS allow alone often isn't enough until reload.
    const [locationNeedsReload, setLocationNeedsReload] = useState(false)
    const [bannerHost, setBannerHost] = useState<HTMLElement | null>(null)
    const [searchOpen, setSearchOpen] = useState(false)

    const applyPosition = (pos: GeolocationPosition) => {
        setLocationRetrying(false)
        setLocationDenied(false)
        setLocationNeedsReload(false)
        const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
        }
        setUserLocation(coords)
        setCenter(coords)
        setSearchBounds(seedBounds(coords, true))
    }

    const applyPositionError = (
        err: GeolocationPositionError,
        fromRetry = false
    ) => {
        // 1=PERMISSION_DENIED 2=POSITION_UNAVAILABLE 3=TIMEOUT
        console.warn(
            `[geolocation] falling back to Adelaide (code ${err.code}): ${err.message}`
        )
        setLocationRetrying(false)
        setLocationDenied(err.code === err.PERMISSION_DENIED)
        if (fromRetry && err.code === err.PERMISSION_DENIED) {
            setLocationNeedsReload(true)
        }
        setCenter((c) => c ?? ADELAIDE_CENTER)
        setSearchBounds((b) => b ?? seedBounds(ADELAIDE_CENTER, false))
    }

    const requestLocation = () => {
        if (!('geolocation' in navigator)) {
            setCenter(ADELAIDE_CENTER)
            setSearchBounds(seedBounds(ADELAIDE_CENTER, false))
            return
        }
        setLocationRetrying(true)
        navigator.geolocation.getCurrentPosition(
            applyPosition,
            (err) => applyPositionError(err, true),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        )
    }

    // Ask once on mount; setState only in geolocation callbacks (or a
    // microtask if the API is missing) so we don't trip set-state-in-effect.
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            queueMicrotask(() => {
                setCenter(ADELAIDE_CENTER)
                setSearchBounds(seedBounds(ADELAIDE_CENTER, false))
            })
            return
        }
        navigator.geolocation.getCurrentPosition(
            applyPosition,
            (err) => applyPositionError(err, false),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        )
    }, [])

    // Portal above the vaul sheet (body z-50) — otherwise the full-height
    // drawer steals taps on Retry even when the banner looks free.
    useEffect(() => {
        queueMicrotask(() => setBannerHost(document.body))
    }, [])

    // Portaled above the home sheet for Retry taps — hide while search is
    // open so it doesn't sit on top of LocationSearchSheet (z-90).
    const topBanner =
        bannerHost &&
        !searchOpen &&
        createPortal(
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] mx-auto flex w-full max-w-md flex-col items-start gap-2 p-4 supports-[display-mode:standalone]:max-w-none">
                <span className="pointer-events-auto inline-block rounded-full bg-primary px-4 py-2 text-lg font-extrabold tracking-tight text-white shadow-lg shadow-primary/25">
                    Adelaide Go Beep
                </span>
                {locationDenied && (
                    <div className="pointer-events-auto flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-lg dark:bg-zinc-800">
                        <span className="min-w-0 flex-1 leading-snug">
                            {locationNeedsReload
                                ? 'Still blocked for this site. Safari aA → Website Settings → Location → Allow, then Reload.'
                                : 'Location is off. Settings → Privacy & Security → Location Services → Safari Websites → While Using, then Retry.'}
                        </span>
                        {locationNeedsReload ? (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
                            >
                                Reload
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={requestLocation}
                                disabled={locationRetrying}
                                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                                {locationRetrying ? 'Checking…' : 'Retry'}
                            </button>
                        )}
                    </div>
                )}
            </div>,
            bannerHost
        )

    return (
        <div className="relative h-full w-full overflow-hidden">
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

            {topBanner}

            <HomeSheet
                activeSnapPoint={snapPoint}
                onSnapPointChange={setSnapPoint}
                nearbyStops={nearbyStops}
                nearbyLoading={nearbyLoading}
                selectedStop={selectedStop}
                onSelectStop={handleSelectStop}
                onSearchOpenChange={setSearchOpen}
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
