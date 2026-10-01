'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
    ArrowUpDown,
    ChevronRight,
    Clock,
    Footprints,
    LocateFixed,
    MapPin,
    RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BusLeg, Journey, TripTime, PickedLocation } from '@/types/route'
import { TripTimeSheet } from './trip-time-sheet'
import { LocationSearchSheet } from '@/components/ui/location-search-sheet'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useDirections } from '@/hooks/useDirections'
import { VehicleMapSheet } from './vehicle-map-sheet'
import { fetchLocationLabel } from '@/util/reverseGeocode'
import { catchHint, delayStatus } from '@/util/route'
import { ModeIcon, LiveDot } from './common'

const JourneyCard = ({
    journey,
    userLocation,
}: {
    journey: Journey
    userLocation: { lat: number; lng: number } | null
}) => {
    // Snapshot the tapped ride so the map shows only that bus, and so the 30s
    // journeys refetch can't swap it out while the sheet is open.
    const [mapLeg, setMapLeg] = useState<BusLeg | null>(null)
    const busIndex = journey.legs.findIndex((l) => l.type === 'bus')
    const bus = journey.legs[busIndex] as BusLeg | undefined
    const walkToStop = journey.legs[busIndex - 1]
    const walkMin = walkToStop?.type === 'walk' ? walkToStop.minutes : 0
    const status = bus && delayStatus(bus)
    // Countdown is the server snapshot; useDirections refetches on an interval
    // so the number (and live delay) stay current. No local ticking — a local
    // countdown drifts to "Due" then jumps back when a fresh prediction lands.
    const departsIn = bus?.departsIn ?? 0
    // Past an hour a countdown is unreadable; show the clock time
    // instead, and skip the catch hint since there's no rush to judge.
    const far = departsIn > 60
    const [clock, meridiem] = journey.departAt.split(/\s+/)
    const hint = bus && !far && catchHint(walkMin, departsIn)
    return (
        <>
            <Link
                href={`/route/${journey.id}`}
                className="block rounded-3xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800"
            >
                <div className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                        {bus && status ? (
                            <div className="min-w-0">
                                <p className="flex items-baseline gap-1.5">
                                    <span
                                        className={cn(
                                            'text-4xl leading-none font-bold tracking-tight tabular-nums',
                                            bus.live
                                                ? 'text-primary dark:text-white'
                                                : 'text-zinc-700 dark:text-zinc-200'
                                        )}
                                    >
                                        {far
                                            ? clock
                                            : bus.departsIn <= 1
                                              ? 'Due'
                                              : bus.departsIn}
                                    </span>
                                    {(far || bus.departsIn > 1) && (
                                        <span className="text-base font-semibold text-zinc-500">
                                            {far ? meridiem : 'min'}
                                        </span>
                                    )}
                                    {!far && (
                                        <span className="ml-1 flex items-center gap-1.5 self-center text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                                            {bus.live && <LiveDot />}
                                            {journey.departAt}
                                        </span>
                                    )}
                                </p>
                                <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                    {!far && 'until '}
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                                        {bus.route}
                                    </span>
                                    <span
                                        className={cn(
                                            'font-medium',
                                            status.className
                                        )}
                                    >
                                        {' '}
                                        · {status.label}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <p className="text-4xl font-bold">
                                {journey.minutes} min
                            </p>
                        )}
                        <div className="shrink-0 text-right">
                            <p className="text-base font-semibold tabular-nums">
                                Arrive {journey.arriveAt}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {journey.minutes} min total
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {journey.legs.map((leg, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                                {i > 0 && (
                                    <ChevronRight className="size-3.5 text-zinc-300 dark:text-zinc-600" />
                                )}
                                {leg.type === 'walk' ? (
                                    <span className="flex h-7 items-center gap-1 rounded-full bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                        <Footprints className="size-3.5" />
                                        {leg.minutes} min
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-white"
                                            style={{
                                                backgroundColor:
                                                    leg.color ??
                                                    'var(--primary)',
                                            }}
                                        >
                                            <ModeIcon
                                                leg={leg}
                                                className="size-3.5"
                                            />
                                            {leg.route}
                                        </span>
                                        {leg.vehicle && (
                                            <button
                                                type="button"
                                                aria-label={`Track ${leg.route} on the map`}
                                                // Inside the card's Link — stop it
                                                // navigating and open the map instead.
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setMapLeg(leg)
                                                }}
                                                className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                style={{
                                                    color:
                                                        leg.color ??
                                                        'var(--primary)',
                                                }}
                                            >
                                                <LocateFixed className="size-4" />
                                            </button>
                                        )}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>

                    {hint && (
                        <p
                            className={cn(
                                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                                hint.className
                            )}
                        >
                            <hint.Icon className="size-4 shrink-0" />
                            {hint.text}
                        </p>
                    )}

                    {bus && (
                        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate text-zinc-500 dark:text-zinc-400">
                                    {bus.from}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </Link>

            <VehicleMapSheet
                open={mapLeg != null}
                onOpenChange={(open) => !open && setMapLeg(null)}
                leg={mapLeg}
                userLocation={userLocation}
            />
        </>
    )
}

const formatTripTime = (when: NonNullable<TripTime>) => {
    const d = when.at
    const time = d.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
    })
    const day =
        d.toDateString() === new Date().toDateString()
            ? ''
            : `${d.toLocaleDateString('en-AU', { weekday: 'short' })} `
    return `${when.mode === 'depart' ? 'Depart' : 'Arrive'} ${day}${time}`
}

// Endpoint from ?{prefix}Lat/Lng/Label, or null if any part is missing.
function readEndpoint(
    params: Pick<URLSearchParams, 'get'>,
    prefix: string
): PickedLocation {
    const lat = Number(params.get(`${prefix}Lat`))
    const lng = Number(params.get(`${prefix}Lng`))
    const label = params.get(`${prefix}Label`)
    return Number.isFinite(lat) && Number.isFinite(lng) && label
        ? { label, lat, lng }
        : null
}

export function RouteScreen() {
    const searchParams = useSearchParams()

    /* Endpoints hold a label + coords (or null when unset), seeded from the URL.
    A missing origin is filled from geolocation on mount if permission is granted.
    Otherwise the user picks it via the search sheet.
    */
    const [origin, setOrigin] = useState<PickedLocation>(() =>
        readEndpoint(searchParams, 'origin')
    )
    const [destination, setDestination] = useState<PickedLocation>(() =>
        readEndpoint(searchParams, 'dest')
    )
    // The origin geolocation filled in. It stays out of the URL: a reload
    // should re-locate, and a shared link should start from the viewer.
    const gpsOrigin = useRef<PickedLocation>(null)

    // Mirror the endpoints back into the URL so a reload or shared link opens
    // what's on screen. replaceState (Next-aware) avoids a history entry per pick.
    useEffect(() => {
        const params = new URLSearchParams()
        const put = (prefix: string, loc: PickedLocation) => {
            if (!loc) return
            params.set(`${prefix}Lat`, String(loc.lat))
            params.set(`${prefix}Lng`, String(loc.lng))
            params.set(`${prefix}Label`, loc.label)
        }
        if (origin !== gpsOrigin.current) put('origin', origin)
        put('dest', destination)
        const qs = params.toString()
        window.history.replaceState(
            null,
            '',
            qs ? `?${qs}` : window.location.pathname
        )
    }, [origin, destination])

    const [when, setWhen] = useState<TripTime>(null)
    const [timeSheetOpen, setTimeSheetOpen] = useState(false)
    const [picking, setPicking] = useState<'origin' | 'destination' | null>(
        null
    )
    const [freeOnly, setFreeOnly] = useState(false)

    const { request: requestLocation, location: userLocation } =
        useGeolocation()

    // On mount, try to seed origin with the current location and its address.
    // request() resolves null if denied/unavailable, leaving origin empty.
    // An origin already set (from the URL, or picked meanwhile) wins.
    useEffect(() => {
        let cancelled = false
        requestLocation().then(async (coords) => {
            if (cancelled || !coords) return
            const label = await fetchLocationLabel(coords.lat, coords.lng)
            if (!cancelled) {
                const gps = { label: label ?? 'Current location', ...coords }
                gpsOrigin.current = gps
                setOrigin((prev) => prev ?? gps)
            }
        })
        return () => {
            cancelled = true
        }
    }, [requestLocation])

    // Real transit journeys once both endpoints are set.
    const { journeys, loading, error, refresh } = useDirections(
        origin,
        destination
    )

    const swap = () => {
        setOrigin(destination)
        setDestination(origin)
    }

    const originLabel = origin?.label ?? 'Choose starting point'
    const destinationLabel = destination?.label ?? 'Choose destination'

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="shrink-0 space-y-2 bg-primary px-4 pt-4 pb-3">
                <h1 className="sr-only">Route</h1>
                <div className="flex items-center gap-2 rounded-2xl bg-white p-2 dark:bg-zinc-900">
                    <div className="flex flex-col items-center gap-1 pl-2">
                        <span className="size-2.5 rounded-full border-2 border-primary" />
                        <span className="h-5 border-l border-dashed border-zinc-300" />
                        <MapPin className="size-3.5 text-alert" />
                    </div>
                    <div className="min-w-0 flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                        <button
                            type="button"
                            onClick={() => setPicking('origin')}
                            className={cn(
                                'block w-full truncate px-2 py-2.5 text-left text-sm font-medium',
                                !origin && 'text-zinc-400'
                            )}
                        >
                            {originLabel}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPicking('destination')}
                            className={cn(
                                'block w-full truncate px-2 py-2.5 text-left text-sm font-medium',
                                !destination && 'text-zinc-400'
                            )}
                        >
                            {destinationLabel}
                        </button>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Swap origin and destination"
                        onClick={swap}
                        className="rounded-full"
                    >
                        <ArrowUpDown className="size-5 text-primary dark:text-accent" />
                    </Button>
                </div>

                {/* Refresh sits under the swap button */}
                <div className="flex min-w-0 items-center gap-2">
                    <button
                        type="button"
                        aria-pressed={!when}
                        onClick={() => setWhen(null)}
                        className={cn(
                            'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors active:scale-[0.97]',
                            !when
                                ? 'bg-white text-primary'
                                : 'bg-white/10 text-white hover:bg-white/20'
                        )}
                    >
                        Leave now
                    </button>
                    <button
                        type="button"
                        aria-pressed={!!when}
                        aria-label={
                            when
                                ? `Change time: ${formatTripTime(when)}`
                                : 'Choose a later time'
                        }
                        onClick={() => setTimeSheetOpen(true)}
                        className={cn(
                            'flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold tabular-nums transition-colors active:scale-[0.97]',
                            when
                                ? 'bg-accent text-primary'
                                : 'bg-white/10 text-white hover:bg-white/20'
                        )}
                    >
                        <Clock className="size-4 shrink-0" />
                        {when && (
                            <span className="truncate">
                                {formatTripTime(when)}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={freeOnly}
                        onClick={() => setFreeOnly((v) => !v)}
                        className={cn(
                            'flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors active:scale-[0.97]',
                            freeOnly
                                ? 'bg-accent text-primary'
                                : 'bg-white/10 text-white hover:bg-white/20'
                        )}
                    >
                        Free 🚌 only
                    </button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh routes"
                        onClick={refresh}
                        disabled={loading}
                        className="mr-2 ml-auto shrink-0 rounded-full text-white hover:bg-white/10 disabled:opacity-100"
                    >
                        <RefreshCw
                            className={cn('size-5', loading && 'animate-spin')}
                        />
                    </Button>
                </div>
            </header>

            <LocationSearchSheet
                open={!!picking}
                onOpenChange={(open) => !open && setPicking(null)}
                placeholder={
                    picking === 'destination'
                        ? 'Select destination'
                        : 'Select origin'
                }
                onSelect={(loc) =>
                    (picking === 'destination' ? setDestination : setOrigin)(
                        loc
                    )
                }
            />
            <TripTimeSheet
                open={timeSheetOpen}
                onOpenChange={setTimeSheetOpen}
                value={when}
                onChange={setWhen}
            />

            {!origin || !destination ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                    <MapPin className="size-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {!origin && !destination
                            ? 'Set your starting point and destination to see routes.'
                            : !origin
                              ? 'Set your starting point to see routes.'
                              : 'Set your destination to see routes.'}
                    </p>
                </div>
            ) : loading ? (
                <div className="flex flex-1 items-center justify-center px-6">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Finding routes…
                    </p>
                </div>
            ) : error ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                    <MapPin className="size-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {error}
                    </p>
                </div>
            ) : (
                <div className="scrollbar-hide flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            {journeys.length}{' '}
                            {journeys.length === 1 ? 'route' : 'routes'}
                        </p>
                    </div>
                    {journeys.map((journey) => (
                        <JourneyCard
                            key={journey.id}
                            journey={journey}
                            userLocation={userLocation}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
