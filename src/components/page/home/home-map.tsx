'use client'

import { useEffect, useRef, useState } from 'react'
import {
    AdvancedMarker,
    APIProvider,
    Map,
    useMap,
} from '@vis.gl/react-google-maps'
import type { MapBounds, NearbyStop } from '@/types/common'
import { STOP_ICON_URL } from '@/util/map/stopIcons'

const IDLE_DEBOUNCE_MS = 600

// Handles two map behaviours that need the live map instance (so it lives
// inside <Map>): panning to a selected stop, and reporting the visible bounds
// after the user moves the map so the parent can re-search that exact area.
function MapController({
    selectedStop,
    onBoundsChange,
}: {
    selectedStop: { lat: number; lng: number } | null
    onBoundsChange: (bounds: MapBounds) => void
}) {
    const map = useMap()
    // Set while we pan programmatically (stop selection); the idle it triggers
    // should not count as a user move, so we skip the re-search for it.
    const programmaticMove = useRef(false)
    // ReturnType<typeof setTimeout> safely types the timer ID across environments:
    // browser returns `number`, Node.js 18+ returns `Timeout` object.
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Pan to the selected stop, lifting it above the bottom sheet.
    useEffect(() => {
        if (!map || !selectedStop) return
        programmaticMove.current = true
        map.setZoom(Math.max(map.getZoom() ?? 0, 18))
        map.panTo({ lat: selectedStop.lat, lng: selectedStop.lng })
        const el = map.getDiv()
        const shift = el ? el.clientHeight * 0.25 : 150
        map.panBy(0, shift)
    }, [map, selectedStop])

    // Re-search the visible area once the map has settled from a user move.
    // Reporting the actual bounds (not a fixed radius) keeps the list in sync
    // with what's on screen — zoom in and only the visible stops remain.
    useEffect(() => {
        if (!map) return
        const listener = map.addListener('idle', () => {
            if (programmaticMove.current) {
                programmaticMove.current = false
                return
            }
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
            debounceTimer.current = setTimeout(() => {
                const b = map.getBounds()
                if (!b) return
                const ne = b.getNorthEast()
                const sw = b.getSouthWest()
                onBoundsChange({
                    north: ne.lat(),
                    south: sw.lat(),
                    east: ne.lng(),
                    west: sw.lng(),
                })
            }, IDLE_DEBOUNCE_MS)
        })
        return () => {
            listener.remove()
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
        }
    }, [map, onBoundsChange])

    return null
}

export function HomeMap({
    center,
    userLocation,
    nearbyStops,
    selectedStop,
    onSelectStop,
    onBoundsChange,
}: {
    center: { lat: number; lng: number }
    userLocation: { lat: number; lng: number } | null
    nearbyStops: NearbyStop[]
    selectedStop: { id: string; lat: number; lng: number } | null
    onSelectStop: (stop: NearbyStop) => void
    onBoundsChange: (bounds: MapBounds) => void
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    // Skeleton covers the map's grey backdrop until the tiles have loaded.
    const [mapReady, setMapReady] = useState(false)

    if (!apiKey) return <div className="map-skeleton relative h-full w-full" />

    return (
        <APIProvider apiKey={apiKey}>
            <div className="relative h-full w-full">
                <Map
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                    className="h-full w-full"
                    clickableIcons={false}
                    defaultCenter={center}
                    defaultZoom={userLocation ? 18 : 15}
                    disableDefaultUI
                    gestureHandling="greedy"
                    onTilesLoaded={() => setMapReady(true)}
                >
                    <MapController
                        selectedStop={selectedStop}
                        onBoundsChange={onBoundsChange}
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
