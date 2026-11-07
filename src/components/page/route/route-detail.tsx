'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Footprints,
    MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BusLeg, Journey, LatLng, WalkLeg } from '@/types/route'
import { RouteMap } from './route-map'
import { useWatchedLocation } from '@/hooks/useGeolocation'
import { decodePolyline } from '@/util/map/polyline'
import { ModeIcon } from './common'

const RouteBadge = ({ leg }: { leg: BusLeg }) => (
    <span
        className="flex h-6 min-w-10 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold text-white"
        style={{ backgroundColor: leg.color ?? 'var(--primary)' }}
    >
        {leg.route}
    </span>
)

// Where a walk starts and ends: the previous ride's last stop (or the
// origin) to the next ride's first stop (or the destination).
function walkPoints(journey: Journey, i: number, walk: WalkLeg): LatLng[] {
    const prev = journey.legs[i - 1]
    const next = journey.legs[i + 1]
    const start = prev?.type === 'bus' ? prev.path.at(-1) : journey.origin
    const end = next?.type === 'bus' ? next.path[0] : journey.destination
    const points: LatLng[] = walk.polylines.flatMap(decodePolyline)
    if (start) points.push(start)
    if (end) points.push(end)
    return points
}

const ridePoints = (bus: BusLeg): LatLng[] => [
    ...bus.path,
    ...(bus.polyline ? decodePolyline(bus.polyline) : []),
]

// Tapping a step frames it on the map (like Google Maps directions).
const FocusButton = ({
    onFocus,
    label,
    children,
}: {
    onFocus: () => void
    label: string
    children: React.ReactNode
}) => (
    <button
        type="button"
        onClick={onFocus}
        aria-label={label}
        className="-mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 text-left transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:active:bg-zinc-800"
    >
        {children}
    </button>
)

/* The timeline is one continuous rail down the left, Google Maps style:
dotted grey while walking, solid in the line's colour while riding. Each step
draws the rail above and below its node, so consecutive steps join up. */
type Rail = { style: 'dotted' | 'solid'; color: string } | null

// zinc-400: zinc-300 dots vanish against white at 2px.
const WALK_RAIL: Rail = { style: 'dotted', color: '#a1a1aa' }
const rideRail = (leg: BusLeg): Rail => ({
    style: 'solid',
    color: leg.color ?? 'var(--primary)',
})

const RailLine = ({ rail, className }: { rail: Rail; className: string }) =>
    rail && (
        <span
            aria-hidden
            className={cn('absolute left-1/2 -translate-x-1/2', className)}
            style={{
                borderLeft:
                    rail.style === 'solid'
                        ? `4px solid ${rail.color}`
                        : `2px dotted ${rail.color}`,
            }}
        />
    )

// Node centre sits 16px down, level with the first (24px-tall) text line.
const Step = ({
    node,
    above,
    below,
    className,
    children,
}: {
    node?: React.ReactNode
    above: Rail
    below: Rail
    className?: string
    children: React.ReactNode
}) => (
    <div className="flex gap-4">
        <div className="relative w-8 shrink-0">
            <RailLine rail={above} className="top-0 h-4" />
            <RailLine rail={below} className="top-4 bottom-0" />
            {node && (
                <div className="relative z-10 flex h-8 items-center justify-center">
                    {node}
                </div>
            )}
        </div>
        <div className={cn('min-w-0 flex-1 pt-1', className)}>{children}</div>
    </div>
)

const IconNode = ({
    className,
    style,
    children,
}: {
    className?: string
    style?: React.CSSProperties
    children: React.ReactNode
}) => (
    <span
        className={cn(
            'flex size-8 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900',
            className
        )}
        style={style}
    >
        {children}
    </span>
)

const StopDot = ({ color, small }: { color: string; small?: boolean }) => (
    <span
        className={cn(
            'rounded-full bg-white dark:bg-zinc-900',
            small ? 'size-2 border-2' : 'size-3.5 border-[3px]'
        )}
        style={{ borderColor: color }}
    />
)

const Title = ({ children }: { children: React.ReactNode }) => (
    <p className="truncate text-[15px] leading-6 font-semibold text-zinc-900 dark:text-zinc-100">
        {children}
    </p>
)

const Sub = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {children}
    </p>
)

// Open, the panel covers the bottom half of the map; closed, it slides fully
// away and a "Show route details" pill (about this tall, plus margin) brings
// it back. The map frames around whichever is showing.
const PILL_PX = 72

export function RouteDetail({ journey }: { journey: Journey }) {
    const router = useRouter()
    const userLocation = useWatchedLocation()
    // What the map should frame after a row tap; null = automatic framing.
    const [target, setTarget] = useState<LatLng[] | null>(null)
    const [closed, setClosed] = useState(false)
    // Hand focus across as the panel hides/shows, so keyboard and screen
    // reader users aren't dropped on <body> when the focused button goes away.
    const showRef = useRef<HTMLButtonElement>(null)
    const hideRef = useRef<HTMLButtonElement>(null)
    const firstToggle = useRef(true)
    useEffect(() => {
        if (firstToggle.current) {
            firstToggle.current = false
            return
        }
        ;(closed ? showRef : hideRef).current?.focus({ preventScroll: true })
    }, [closed])
    // Which rides have their intermediate stops expanded, by leg index.
    const [openStops, setOpenStops] = useState<Record<number, boolean>>({})

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-0">
                <RouteMap
                    journey={journey}
                    userLocation={userLocation}
                    focus="boarding"
                    target={target}
                    sheet={closed ? `${PILL_PX}px` : 0.5}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Go back"
                    onClick={() => router.back()}
                    className="absolute top-3 left-3 rounded-full bg-white text-primary shadow-lg hover:bg-white dark:bg-zinc-800 dark:text-zinc-100"
                >
                    <ArrowLeft className="size-5" />
                </Button>
            </div>

            {/* inert while hidden: off screen, so not tabbable or read out. */}
            <section
                id="route-panel"
                inert={closed}
                aria-label="Route details"
                className={cn(
                    'absolute inset-x-0 bottom-0 z-10 flex h-1/2 flex-col rounded-t-[28px] bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out dark:bg-zinc-900',
                    closed && 'translate-y-full'
                )}
            >
                <div className="flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-6 dark:border-zinc-800">
                    {/* No live status here: this is a saved plan, and any delay
                    shown would be from whenever it was saved. */}
                    <div className="min-w-0">
                        <p className="text-[22px] leading-7 font-bold tracking-tight tabular-nums">
                            {journey.departAt} – {journey.arriveAt}
                        </p>
                        <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                            {journey.minutes} min total
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        ref={hideRef}
                        aria-expanded={!closed}
                        aria-controls="route-panel"
                        aria-label="Hide route details"
                        onClick={() => setClosed(true)}
                        className="size-10 shrink-0 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                        <ChevronDown className="size-5" />
                    </Button>
                </div>
                <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-10">
                    {journey.legs.map((leg, i) => {
                        const prev = journey.legs[i - 1]
                        // The rail coming into this leg from the one before.
                        const into: Rail =
                            i === 0
                                ? null
                                : prev?.type === 'bus'
                                  ? rideRail(prev)
                                  : WALK_RAIL
                        if (leg.type === 'walk') {
                            return (
                                <Step
                                    key={i}
                                    above={into}
                                    below={WALK_RAIL}
                                    className="pb-7"
                                    node={
                                        <IconNode className="bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                            <Footprints className="size-4" />
                                        </IconNode>
                                    }
                                >
                                    <FocusButton
                                        label={`Show ${leg.minutes} min walk on the map`}
                                        onFocus={() =>
                                            setTarget(
                                                walkPoints(journey, i, leg)
                                            )
                                        }
                                    >
                                        <Title>Walk {leg.minutes} min</Title>
                                        {/* Journeys saved before walks were
                                        named have an empty `to`. */}
                                        {leg.to && <Sub>to {leg.to}</Sub>}
                                    </FocusButton>
                                </Step>
                            )
                        }

                        const rail = rideRail(leg)
                        const color = leg.color ?? 'var(--primary)'
                        const middle = leg.path.slice(1, -1)
                        const board = leg.path[0]
                        const alight = leg.path.at(-1)
                        const showStops = openStops[i] ?? false
                        return (
                            <Fragment key={i}>
                                <Step
                                    above={into}
                                    below={rail}
                                    className="pb-5"
                                    node={
                                        <IconNode
                                            className="text-white"
                                            style={{ backgroundColor: color }}
                                        >
                                            <ModeIcon
                                                leg={leg}
                                                className="size-4"
                                            />
                                        </IconNode>
                                    }
                                >
                                    <FocusButton
                                        label={`Show the ${leg.route} ride on the map`}
                                        onFocus={() =>
                                            setTarget(ridePoints(leg))
                                        }
                                    >
                                        <div className="flex h-6 items-center gap-2">
                                            <RouteBadge leg={leg} />
                                            <Title>to {leg.headsign}</Title>
                                        </div>
                                        <Sub>{leg.minutes} min ride</Sub>
                                    </FocusButton>
                                </Step>

                                <Step
                                    above={rail}
                                    below={rail}
                                    className="pb-4"
                                    node={<StopDot color={color} />}
                                >
                                    <FocusButton
                                        label={`Show ${leg.from} on the map`}
                                        onFocus={() =>
                                            board && setTarget([board])
                                        }
                                    >
                                        <p className="truncate text-sm leading-6 font-medium">
                                            {leg.from}
                                        </p>
                                        <Sub>
                                            Board
                                            {leg.fromCode &&
                                                ` · Stop ${leg.fromCode}`}
                                        </Sub>
                                    </FocusButton>
                                </Step>

                                {middle.length > 0 && (
                                    <Step
                                        above={rail}
                                        below={rail}
                                        className="pb-4"
                                    >
                                        <button
                                            type="button"
                                            aria-expanded={showStops}
                                            onClick={() =>
                                                setOpenStops((o) => ({
                                                    ...o,
                                                    [i]: !showStops,
                                                }))
                                            }
                                            className="inline-flex h-7 items-center gap-1 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                        >
                                            {middle.length + 1} stops
                                            <ChevronDown
                                                className={cn(
                                                    'size-3.5 transition-transform',
                                                    showStops && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    </Step>
                                )}

                                {showStops &&
                                    middle.map((stop, k) => (
                                        // Index too: loop routes can pass a
                                        // stop twice.
                                        <Step
                                            key={`${k}-${stop.name}`}
                                            above={rail}
                                            below={rail}
                                            className="pb-1"
                                            node={
                                                <StopDot color={color} small />
                                            }
                                        >
                                            <FocusButton
                                                label={`Show ${stop.name} on the map`}
                                                onFocus={() =>
                                                    setTarget([stop])
                                                }
                                            >
                                                <p className="truncate text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
                                                    {stop.name}
                                                </p>
                                            </FocusButton>
                                        </Step>
                                    ))}

                                <Step
                                    above={rail}
                                    // Into the walk/ride after, if any.
                                    below={
                                        journey.legs[i + 1]?.type === 'bus'
                                            ? rideRail(
                                                  journey.legs[i + 1] as BusLeg
                                              )
                                            : WALK_RAIL
                                    }
                                    className="pb-7"
                                    node={<StopDot color={color} />}
                                >
                                    <FocusButton
                                        label={`Show ${leg.to} on the map`}
                                        onFocus={() =>
                                            alight && setTarget([alight])
                                        }
                                    >
                                        <p className="truncate text-sm leading-6 font-medium">
                                            {leg.to}
                                        </p>
                                        <Sub>Get off</Sub>
                                    </FocusButton>
                                </Step>
                            </Fragment>
                        )
                    })}

                    <Step
                        above={
                            journey.legs.at(-1)?.type === 'bus'
                                ? rideRail(journey.legs.at(-1) as BusLeg)
                                : WALK_RAIL
                        }
                        below={null}
                        node={
                            <IconNode className="bg-alert/10 text-alert">
                                <MapPin className="size-4" />
                            </IconNode>
                        }
                    >
                        <FocusButton
                            label="Show the destination on the map"
                            onFocus={() => setTarget([journey.destination])}
                        >
                            <Title>Arrive {journey.arriveAt}</Title>
                            <Sub>{journey.destination.name}</Sub>
                        </FocusButton>
                    </Step>
                </div>
            </section>

            <button
                ref={showRef}
                type="button"
                aria-expanded={!closed}
                aria-controls="route-panel"
                onClick={() => setClosed(false)}
                className={cn(
                    'absolute bottom-4 left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold whitespace-nowrap text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out active:scale-95',
                    // Fades in as the panel leaves, out as it returns.
                    closed
                        ? 'opacity-100'
                        : 'pointer-events-none translate-y-4 opacity-0'
                )}
                tabIndex={closed ? 0 : -1}
                aria-hidden={!closed}
            >
                <ChevronUp className="size-4" />
                Show route details
            </button>
        </div>
    )
}
