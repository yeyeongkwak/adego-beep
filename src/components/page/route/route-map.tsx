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
import { decodePolyline } from '@/util/map/polyline'
import { fitCamera, type Padding } from '@/util/map/fitCamera'

/* Draws the legs as polylines (bus solid in route colour, walks dotted) and
the stops, Google Maps style. Lines, camera and the user's dot are separate so
a moving GPS fix only moves the dot. See Camera for how the view is framed.
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

// Road line per ride: the GTFS shape when loaded, else Google's road line,
// else a straight line between stops. Walks: one line per Google walk step.
function journeyLines(journey: Journey) {
    const buses = journey.legs.filter((l): l is BusLeg => l.type === 'bus')
    const busLines = buses.map((bus) =>
        bus.shape.length > 1
            ? bus.shape
            : bus.polyline
              ? decodePolyline(bus.polyline)
              : bus.path
    )
    const walkLines = journey.legs
        .filter((l): l is WalkLeg => l.type === 'walk')
        .flatMap((w) => w.polylines.map(decodePolyline))
        .filter((line) => line.length > 1)
    return { buses, busLines, walkLines }
}

// Drawn only when the journey changes — the user's dot moves on its own
// marker, so GPS updates never rebuild these.
function JourneyLines({ journey }: { journey: Journey }) {
    const map = useMap()

    useEffect(() => {
        if (!map) return
        const { buses, busLines, walkLines } = journeyLines(journey)
        const lines: google.maps.Polyline[] = []

        buses.forEach((bus, i) => {
            lines.push(
                new google.maps.Polyline({
                    map,
                    path: busLines[i],
                    strokeColor: bus.color ?? '#002b5c',
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                })
            )
        })

        // Walks dotted like Google Maps: invisible stroke, repeating dots.
        for (const walk of walkLines) {
            lines.push(
                new google.maps.Polyline({
                    map,
                    path: walk,
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

        return () => lines.forEach((l) => l.setMap(null))
    }, [map, journey])

    return null
}

// Further than this from the boarding stop (e.g. reopening an old trip from
// home), framing both would shrink the route to nothing; show the route.
const NEAR_BOARDING_KM = 5

// Keep framed points clear of the back button (top) and of whatever a bottom
// sheet covers, so they land in the part of the map you can actually see.
const paddingFor = (coverPx: number): Padding => ({
    top: 72,
    left: 40,
    right: 40,
    bottom: coverPx + 32,
})

// One glide per map at a time; a new one (or the user grabbing the map)
// cancels the last.
const glides = new WeakMap<google.maps.Map, number>()
const stopGlide = (map: google.maps.Map) =>
    cancelAnimationFrame(glides.get(map) ?? 0)

const GLIDE_MS = 600
const easeInOut = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

// Ease the camera to `to` (fractional zoom keeps vector maps smooth).
// Instant for reduced-motion users.
const glide = (map: google.maps.Map, to: { center: LatLng; zoom: number }) => {
    stopGlide(map)
    const from = map.getCenter()
    const fromZoom = map.getZoom()
    if (
        !from ||
        fromZoom == null ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        map.moveCamera(to)
        return
    }
    const start = performance.now()
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / GLIDE_MS)
        const k = easeInOut(t)
        map.moveCamera({
            center: {
                lat: from.lat() + (to.center.lat - from.lat()) * k,
                lng: from.lng() + (to.center.lng - from.lng()) * k,
            },
            zoom: fromZoom + (to.zoom - fromZoom) * k,
        })
        if (t < 1) glides.set(map, requestAnimationFrame(step))
    }
    glides.set(map, requestAnimationFrame(step))
}

// Frame points in the visible area, never closer than maxZoom (so one point,
// or two very close ones, stay at street level). Glides there unless
// `instant` (the very first framing, where there's nothing to glide from).
const fit = (
    map: google.maps.Map,
    points: LatLng[],
    coverPx: number,
    maxZoom = 17,
    instant = false
) => {
    if (!points.length) return
    const div = map.getDiv()
    const camera = fitCamera(
        points,
        { w: div.clientWidth, h: div.clientHeight },
        paddingFor(coverPx),
        maxZoom
    )
    if (instant) {
        stopGlide(map)
        map.moveCamera(camera)
    } else glide(map, camera)
}

const journeyPoints = (journey: Journey): LatLng[] => {
    const { buses, busLines, walkLines } = journeyLines(journey)
    return [
        journey.origin,
        journey.destination,
        ...buses.flatMap((b) => b.path),
        ...busLines.flat(),
        ...walkLines.flat(),
    ]
}

// Two points: zoom out further the further apart they are.
const pairMaxZoom = (a: LatLng, b: LatLng) => {
    const km = haversineKm(a, b)
    return km < 0.3 ? 17 : km < 1 ? 16 : km < 3 ? 15 : 13
}

// vaul snap point -> px of the map it covers (fraction of height, or "Npx").
const coverPx = (map: google.maps.Map, sheet: number | string) =>
    typeof sheet === 'number'
        ? map.getDiv().clientHeight * sheet
        : parseFloat(sheet) || 0

/* Initial camera. Never fights the user: once they drag, it stops.
- 'boarding' (journey detail): you + your boarding stop. Until the first GPS
  fix (or if you're far away) it shows the whole route, then refits once.
- 'vehicle' (live bus sheet): the bus + you, framed once.
- `target` (a tapped timeline row) always wins and ends the automatic
  framing, same as the user dragging the map.
All framing leaves room for `sheet` (a bottom sheet over the map).
*/
function Camera({
    journey,
    userLocation,
    focus,
    target,
    sheet,
}: {
    journey: Journey
    userLocation: LatLng | null
    focus: 'boarding' | 'vehicle'
    target: LatLng[] | null
    sheet: number | string
}) {
    const map = useMap()
    const framed = useRef<'none' | 'route' | 'final'>('none')
    const touched = useRef(false)
    // Read at framing time; the sheet moving shouldn't itself move the map.
    const sheetRef = useRef(sheet)
    useEffect(() => {
        sheetRef.current = sheet
    }, [sheet])

    useEffect(() => {
        if (!map) return
        const l = map.addListener('dragstart', () => {
            touched.current = true
            stopGlide(map)
        })
        return () => l.remove()
    }, [map])

    // A new array per tap, so tapping the same row again re-centres it.
    useEffect(() => {
        if (!map || !target?.length) return
        fit(map, target, coverPx(map, sheetRef.current))
        touched.current = true
    }, [map, target])

    useEffect(() => {
        if (!map || framed.current === 'final' || touched.current) return
        const cover = coverPx(map, sheetRef.current)
        const buses = journey.legs.filter((l): l is BusLeg => l.type === 'bus')

        if (focus === 'vehicle') {
            const vehicle = buses.find((b) => b.vehicle)?.vehicle ?? null
            if (vehicle && userLocation)
                fit(
                    map,
                    [vehicle, userLocation],
                    cover,
                    pairMaxZoom(vehicle, userLocation),
                    true
                )
            else if (vehicle) fit(map, [vehicle], cover, 15, true)
            else fit(map, journeyPoints(journey), cover, 17, true)
            framed.current = 'final'
            return
        }

        const board = buses[0]?.path[0] ?? journey.origin
        if (
            userLocation &&
            haversineKm(userLocation, board) < NEAR_BOARDING_KM
        ) {
            fit(
                map,
                [userLocation, board],
                cover,
                pairMaxZoom(userLocation, board)
            )
            framed.current = 'final'
        } else if (framed.current === 'none') {
            fit(map, journeyPoints(journey), cover, 17, true)
            framed.current = 'route'
        }
    }, [map, journey, userLocation, focus])

    return null
}

export function RouteMap({
    journey,
    userLocation = null,
    // origin dot + destination pin only make sense for a whole journey
    // vehicle map) hides them.
    showEndpoints = true,
    focus = 'vehicle',
    target = null,
    // Bottom sheet over the map, as a vaul snap point (0.5 or "160px").
    sheet = 0,
}: {
    journey: Journey
    userLocation?: LatLng | null
    showEndpoints?: boolean
    focus?: 'boarding' | 'vehicle'
    target?: LatLng[] | null
    sheet?: number | string
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
                    <JourneyLines journey={journey} />
                    <Camera
                        journey={journey}
                        userLocation={userLocation}
                        focus={focus}
                        target={target}
                        sheet={sheet}
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
