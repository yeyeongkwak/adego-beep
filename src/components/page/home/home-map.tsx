'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    AdvancedMarker,
    APIProvider,
    Map,
    useMap,
    type MapEvent,
} from '@vis.gl/react-google-maps'
import { LocateFixed } from 'lucide-react'
import type { MapBounds } from '@/types/geo'
import type { NearbyStop } from '@/types/place'
import { STOP_ICON_URL } from '@/util/map/stopIcons'

const IDLE_DEBOUNCE_MS = 600

function boundsFromMap(map: google.maps.Map): MapBounds | null {
    const b = map.getBounds()
    if (!b) return null
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    return {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
    }
}

function RecenterButton({
    userLocation,
    sheetFraction,
}: {
    userLocation: { lat: number; lng: number } | null
    sheetFraction: number
}) {
    const map = useMap()
    if (!map || !userLocation) return null
    return (
        <button
            type="button"
            aria-label="Center on my location"
            onClick={() => {
                const zoom = map.getZoom() ?? 0
                if (zoom < 16) map.setZoom(16)
                map.panTo(userLocation)
            }}
            // Sit 12px above the sheet's top edge; falls back near the bottom
            // when the sheet is collapsed.
            style={{ bottom: `calc(${sheetFraction * 100}% + 12px)` }}
            className="absolute right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-[bottom] duration-300 active:scale-95 dark:bg-zinc-800 dark:text-zinc-100"
        >
            <LocateFixed className="size-5" />
        </button>
    )
}

function MapController({
    selectedStop,
    programmaticMoveRef,
}: {
    selectedStop: { lat: number; lng: number } | null
    programmaticMoveRef: { current: boolean }
}) {
    const map = useMap()

    // Pan to the selected stop, lifting it above the bottom sheet.
    useEffect(() => {
        if (!map || !selectedStop) return
        programmaticMoveRef.current = true
        map.setZoom(Math.max(map.getZoom() ?? 0, 18))
        map.panTo({ lat: selectedStop.lat, lng: selectedStop.lng })
        const el = map.getDiv()
        const shift = el ? el.clientHeight * 0.25 : 150
        map.panBy(0, shift)
    }, [map, selectedStop, programmaticMoveRef])

    return null
}

export function HomeMap({
    center,
    userLocation,
    nearbyStops,
    selectedStop,
    onSelectStop,
    onBoundsChange,
    sheetFraction,
}: {
    center: { lat: number; lng: number }
    userLocation: { lat: number; lng: number } | null
    nearbyStops: NearbyStop[]
    selectedStop: { id: string; lat: number; lng: number } | null
    onSelectStop: (stop: NearbyStop) => void
    onBoundsChange: (bounds: MapBounds) => void
    sheetFraction: number
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    // Skeleton covers the map's grey backdrop until the tiles have loaded.
    const [mapReady, setMapReady] = useState(false)

    // Skip Nearby refetch after stop-select pans; still publish the first
    // bounds so the list never sticks on Loading.
    const programmaticMoveRef = useRef(false)
    const reportedOnceRef = useRef(false)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onBoundsChangeRef = useRef(onBoundsChange)

    useEffect(() => {
        onBoundsChangeRef.current = onBoundsChange
    }, [onBoundsChange])

    const publish = useCallback((map: google.maps.Map): boolean => {
        const bounds = boundsFromMap(map)
        if (!bounds) return false
        onBoundsChangeRef.current(bounds)
        reportedOnceRef.current = true
        return true
    }, [])

    // Library wires Map event props when the instance exists — prefer that
    // over a hand-rolled useEffect(addListener) that can miss the first idle.
    const handleIdle = useCallback(
        (ev: MapEvent) => {
            if (programmaticMoveRef.current) {
                programmaticMoveRef.current = false
                if (reportedOnceRef.current) return
            }
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = setTimeout(() => {
                publish(ev.map)
            }, IDLE_DEBOUNCE_MS)
        },
        [publish]
    )

    const handleTilesLoaded = useCallback(
        (ev: MapEvent) => {
            setMapReady(true)
            // Tiles mean projection/bounds are available — seed Nearby even if
            // the first idle was already consumed before React subscribed.
            if (!reportedOnceRef.current) publish(ev.map)
        },
        [publish]
    )

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        }
    }, [])

    if (!apiKey) return <div className="map-skeleton relative h-full w-full" />

    return (
        <APIProvider apiKey={apiKey}>
            {/* Own compositor layer so iOS PWA + drawer transform don't blur tiles */}
            <div className="relative h-full w-full transform-gpu backface-hidden">
                <Map
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                    className="h-full w-full"
                    clickableIcons={false}
                    defaultCenter={center}
                    defaultZoom={userLocation ? 18 : 15}
                    disableDefaultUI
                    gestureHandling="greedy"
                    onIdle={handleIdle}
                    onTilesLoaded={handleTilesLoaded}
                >
                    <MapController
                        selectedStop={selectedStop}
                        programmaticMoveRef={programmaticMoveRef}
                    />

                    {mapReady && userLocation && (
                        <AdvancedMarker
                            position={userLocation}
                            title="Current location"
                        >
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    backgroundColor: '#2563EB',
                                    border: '3px solid #FFFFFF',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                                }}
                            />
                        </AdvancedMarker>
                    )}
                    {mapReady &&
                        nearbyStops.map((stop) => {
                            const isSelected = stop.id === selectedStop?.id
                            return (
                                <AdvancedMarker
                                    key={stop.id}
                                    position={{ lat: stop.lat, lng: stop.lng }}
                                    title={`${stop.name}${stop.code ? ` (${stop.code})` : ''}`}
                                    zIndex={isSelected ? 10 : undefined}
                                    onClick={() => onSelectStop(stop)}
                                >
                                    {isSelected ? (
                                        <div className="relative flex items-center justify-center">
                                            {/* Gold pulse ring behind the marker. */}
                                            <span className="absolute inline-flex size-12 animate-ping rounded-full bg-accent/40" />
                                            <span className="absolute inline-flex size-12 rounded-full border-2 border-accent bg-accent/15" />
                                            <img
                                                src={STOP_ICON_URL[stop.mode]}
                                                width={42}
                                                height={42}
                                                alt=""
                                                className="relative drop-shadow-md"
                                            />
                                        </div>
                                    ) : (
                                        <img
                                            src={STOP_ICON_URL[stop.mode]}
                                            width={32}
                                            height={32}
                                            alt=""
                                        />
                                    )}
                                </AdvancedMarker>
                            )
                        })}
                    <RecenterButton
                        userLocation={userLocation}
                        sheetFraction={sheetFraction}
                    />
                </Map>

                <div
                    aria-hidden
                    className={`map-skeleton pointer-events-none absolute inset-0 transition-opacity duration-500 ${
                        mapReady ? 'opacity-0' : 'opacity-100'
                    }`}
                />
            </div>
        </APIProvider>
    )
}
