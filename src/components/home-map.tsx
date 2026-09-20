'use client'

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import type { NearbyStop } from '@/types/common'
import { STOP_ICON_URL } from '@/util/map/stopIcons'

export function HomeMap({
    center,
    userLocation,
    nearbyStops,
}: {
    center: { lat: number; lng: number }
    userLocation: { lat: number; lng: number } | null
    nearbyStops: NearbyStop[]
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey)
        return <div className="h-full w-full bg-zinc-100 dark:bg-zinc-900" />

    return (
        <APIProvider apiKey={apiKey}>
            <Map
                className="h-full w-full"
                clickableIcons={false}
                defaultCenter={center}
                defaultZoom={userLocation ? 18 : 15}
                disableDefaultUI
                gestureHandling="greedy"
            >
                {userLocation && (
                    <Marker
                        position={userLocation}
                        title="Current location"
                        icon={{
                            path: 0 as google.maps.SymbolPath, // SymbolPath.CIRCLE
                            scale: 8,
                            fillColor: '#2563EB',
                            fillOpacity: 1,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 3,
                        }}
                    />
                )}
                {nearbyStops.map((stop) => (
                    <Marker
                        key={stop.id}
                        position={{ lat: stop.lat, lng: stop.lng }}
                        title={`${stop.name}${stop.code ? ` (${stop.code})` : ''}`}
                        icon={{
                            url: STOP_ICON_URL[stop.mode],
                            scaledSize: {
                                width: 32,
                                height: 32,
                            } as google.maps.Size,
                            anchor: { x: 16, y: 16 } as google.maps.Point,
                        }}
                        // onClick={() => onSelectedStopChange(stop)}
                    />
                ))}
            </Map>
        </APIProvider>
    )
}
