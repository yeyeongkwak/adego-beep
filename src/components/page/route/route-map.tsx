'use client'

import { useEffect, useRef, useState } from 'react'
import {
    AdvancedMarker,
    APIProvider,
    Map,
    useMap,
} from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import type { BusLeg, Journey, LatLng, WalkLeg } from '@/types/route'
import { ModeIcon } from './common'
import { haversineKm } from '@/util/map/distance'

/* Draws the legs as polylines (bus solid in route colour, walks dotted)
and the stops, Google Maps style, then frames the camera. When we have both a live
vehicle and the user's location, it zooms to those two (that's what the rider
cares about); otherwise it falls back to framing the whole journey.
*/

// Get off / board this close together is one transfer point, not two pins.
const TRANSFER_MERGE_KM = 0.08

type Callout = {
    at: LatLng
    title: string
    rows: { text: string; color: string }[]
}

// Where you board and get off each ride. A transfer (get off one, board the
// next nearby) collapses into a single callout listing both.
function rideCallouts(buses: BusLeg[]): Callout[] {
    const out: Callout[] = []
    buses.forEach((bus, i) => {
        const board = bus.path[0]
        const alight = bus.path[bus.path.length - 1]
        const color = bus.color ?? 'var(--primary)'
        if (!board || !alight) return
        const prev = out[out.length - 1]
        const boardRow = { text: `Board ${bus.route}`, color }
        if (i > 0 && prev && haversineKm(prev.at, board) < TRANSFER_MERGE_KM) {
            prev.rows.push(boardRow)
        } else {
            out.push({ at: board, title: board.name, rows: [boardRow] })
        }
        out.push({
            at: alight,
            title: alight.name,
            rows: [{ text: `Get off ${bus.route}`, color }],
        })
    })
    return out
}

const StopCallout = ({ rows }: { rows: Callout['rows'] }) => (
    // Bubble above, tail, then the dot sitting on the stop. The marker anchors
    // at bottom-centre, so nudge down half the dot to centre it on the point.
    <div className="flex translate-y-1.5 flex-col items-center">
        <div className="rounded-xl bg-white px-2.5 py-1.5 shadow-md dark:bg-zinc-800">
            {rows.map((r) => (
                <p
                    key={r.text}
                    className="text-[11px] leading-4 font-bold whitespace-nowrap"
                    style={{ color: r.color }}
                >
                    {r.text}
                </p>
            ))}
        </div>
        <div className="-mt-1 size-2 rotate-45 bg-white dark:bg-zinc-800" />
        <div
            className="mt-0.5 size-3 rounded-full border-[3px] bg-white shadow"
            style={{ borderColor: rows[0].color }}
        />
    </div>
)

function JourneyLines({
    journey,
    userLocation,
}: {
    journey: Journey
    userLocation: LatLng | null
}) {
    const map = useMap()
    // Camera framing runs once on first mount. Subsequent journey updates
    // (e.g. vehicle position polling) only redraw markers — they must NOT
    // reset the zoom/pan because the user may have manually panned/zoomed.
    const cameraSentRef = useRef(false)

    useEffect(() => {
        if (!map) return
        const lines: google.maps.Polyline[] = []
        const buses = journey.legs.filter((l): l is BusLeg => l.type === 'bus')

        // Solid coloured line per ride: the road shape when we have it, else a
        // straight line between stops.
        for (const bus of buses) {
            const line = bus.shape.length > 1 ? bus.shape : bus.path
            lines.push(
                new google.maps.Polyline({
                    map,
                    path: line,
                    strokeColor: bus.color ?? '#002b5c',
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                })
            )
        }

        // Walks dotted like Google Maps: invisible stroke, repeating dots.
        const walks = journey.legs.filter(
            (l): l is WalkLeg => l.type === 'walk' && l.path.length > 1
        )
        for (const walk of walks) {
            lines.push(
                new google.maps.Polyline({
                    map,
                    path: walk.path,
                    strokeOpacity: 0,
                    icons: [
                        {
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 3,
                                fillColor: '#3b82f6',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                            },
                            offset: '0',
                            repeat: '12px',
                        },
                    ],
                })
            )
        }

        // Camera focus — only on first render (not on vehicle position updates).
        if (!cameraSentRef.current) {
            const vehicle = buses.find((b) => b.vehicle)?.vehicle ?? null
            const bounds = new google.maps.LatLngBounds()
            if (vehicle && userLocation) {
                const distKm = haversineKm(vehicle, userLocation)
                const targetZoom =
                    distKm < 0.3 ? 17 : distKm < 1 ? 16 : distKm < 3 ? 15 : 13
                bounds.extend(vehicle)
                bounds.extend(userLocation)
                map.fitBounds(bounds, 80)
                google.maps.event.addListenerOnce(map, 'idle', () => {
                    const actual = map.getZoom() ?? targetZoom
                    const clamped = Math.min(actual, targetZoom)
                    if (clamped !== actual) map.setZoom(clamped)
                })
            } else if (vehicle) {
                map.panTo(vehicle)
                map.setZoom(15)
            } else {
                bounds.extend(journey.origin)
                bounds.extend(journey.destination)
                buses.forEach((b) => {
                    b.path.forEach((p) => bounds.extend(p))
                    b.shape.forEach((p) => bounds.extend(p))
                })
                walks.forEach((w) => w.path.forEach((p) => bounds.extend(p)))
                if (userLocation) bounds.extend(userLocation)
                map.fitBounds(bounds, 48)
            }
            cameraSentRef.current = true
        }

        return () => lines.forEach((l) => l.setMap(null))
    }, [map, journey, userLocation])

    return null
}

export function RouteMap({
    journey,
    userLocation = null,
    // origin dot + destination pin only make sense for a whole journey
    // vehicle map) hides them.
    showEndpoints = true,
}: {
    journey: Journey
    userLocation?: LatLng | null
    showEndpoints?: boolean
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const [mapReady, setMapReady] = useState(false)
    const buses = journey.legs.filter((l): l is BusLeg => l.type === 'bus')

    if (!apiKey) return <div className="map-skeleton relative h-full w-full" />

    return (
        <APIProvider apiKey={apiKey}>
            <div className="relative h-full w-full">
                <Map
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
                    className="h-full w-full"
                    clickableIcons={false}
                    defaultCenter={journey.origin}
                    defaultZoom={13}
                    disableDefaultUI
                    gestureHandling="greedy"
                    onTilesLoaded={() => setMapReady(true)}
                >
                    <JourneyLines
                        journey={journey}
                        userLocation={userLocation}
                    />

                    {mapReady && (
                        <>
                            {userLocation && (
                                <AdvancedMarker
                                    position={userLocation}
                                    title="Your location"
                                    zIndex={20}
                                >
                                    <div className="size-4 rounded-full border-[3px] border-white bg-blue-600 shadow" />
                                </AdvancedMarker>
                            )}
                            {showEndpoints && (
                                <AdvancedMarker
                                    position={journey.origin}
                                    title={journey.origin.name}
                                >
                                    <div className="size-3 rounded-full border-2 border-white bg-zinc-400 shadow" />
                                </AdvancedMarker>
                            )}

                            {buses.map((bus) => {
                                const color = bus.color ?? 'var(--primary)'
                                const last = bus.path.length - 1
                                return bus.path.map((stop, i) => {
                                    const isEnd = i === 0 || i === last
                                    // On a whole journey the ends get callouts
                                    // below. (The vehicle sheet's path is the
                                    // full trip, so its ends are just terminals.)
                                    if (isEnd && showEndpoints) return null
                                    return (
                                        <AdvancedMarker
                                            key={`${bus.route}-${i}`}
                                            position={stop}
                                            title={stop.name}
                                            zIndex={isEnd ? 5 : 1}
                                        >
                                            <div
                                                className={
                                                    isEnd
                                                        ? 'size-4 rounded-full border-4 bg-white shadow'
                                                        : 'size-2.5 rounded-full border-2 bg-white'
                                                }
                                                style={{ borderColor: color }}
                                            />
                                        </AdvancedMarker>
                                    )
                                })
                            })}

                            {showEndpoints &&
                                rideCallouts(buses).map((c, i) => (
                                    <AdvancedMarker
                                        key={`callout-${i}`}
                                        position={c.at}
                                        title={c.title}
                                        zIndex={6}
                                    >
                                        <StopCallout rows={c.rows} />
                                    </AdvancedMarker>
                                ))}

                            {buses.map(
                                (bus) =>
                                    bus.vehicle && (
                                        <AdvancedMarker
                                            key={`${bus.route}-vehicle`}
                                            position={bus.vehicle}
                                            title={`${bus.route} · near ${bus.vehicle.nearStop}`}
                                            zIndex={10}
                                        >
                                            <div
                                                className="flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md"
                                                style={{
                                                    backgroundColor:
                                                        bus.color ??
                                                        'var(--primary)',
                                                }}
                                            >
                                                <ModeIcon
                                                    leg={bus}
                                                    className="size-4"
                                                />
                                            </div>
                                        </AdvancedMarker>
                                    )
                            )}

                            {showEndpoints && (
                                <AdvancedMarker
                                    position={journey.destination}
                                    title={journey.destination.name}
                                    zIndex={5}
                                >
                                    <MapPin className="size-8 fill-alert text-white drop-shadow" />
                                </AdvancedMarker>
                            )}
                        </>
                    )}
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
