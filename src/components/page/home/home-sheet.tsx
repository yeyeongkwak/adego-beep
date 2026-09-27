'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronUp, MapPin, Search } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStopArrival } from '@/hooks/useStopArrival'
import { cn } from '@/lib/utils'
import { Stop, STOP_MODE_STYLE } from '@/types/common'
import { StopList } from '@/components/ui/home'
import { formatDistance } from '@/util/map/distance'
import { formatArrival } from '@/util/arrival'

// Mock data — placeholder until auth-backed favourites/history replace these.
const FAVOURITE_STOPS: Stop[] = [
    {
        id: 'fav-1',
        name: 'King William St',
        code: 'KWS001',
        lat: -34.9285,
        lng: 138.6007,
    },
    {
        id: 'fav-2',
        name: 'University of Adelaide',
        code: 'UNIV01',
        lat: -34.9205,
        lng: 138.6045,
    },
]
const RECENT_STOPS: Stop[] = [
    {
        id: 'rec-1',
        name: 'Henley Beach',
        code: 'HEN01',
        lat: -34.9161,
        lng: 138.4964,
    },
    {
        id: 'rec-2',
        name: 'Glenelg',
        code: 'GLE01',
        lat: -34.9805,
        lng: 138.5156,
    },
]

function StopArrivalsPanel({
    stop,
    onBack,
}: {
    stop: Stop
    onBack: () => void
}) {
    const style = stop.mode ? STOP_MODE_STYLE[stop.mode] : null
    const Icon = style?.icon ?? MapPin
    const { arrivals, loading, error } = useStopArrival(stop.id)

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex shrink-0 items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-full"
                    onClick={onBack}
                >
                    <ArrowLeft className="size-5" />
                </Button>
                <div
                    className={`rounded-full p-2.5 ${style?.bgClass ?? 'bg-zinc-100 dark:bg-zinc-800'}`}
                >
                    <Icon
                        className={`size-5 ${style?.iconClass ?? 'text-primary'}`}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">{stop.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {stop.code ? `Stop ${stop.code}` : 'Stop'}
                        {stop.distanceM != null
                            ? ` · ${formatDistance(stop.distanceM)} away`
                            : ''}
                    </p>
                </div>
            </div>

            {arrivals.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    Live arrivals
                </div>
            )}

            {error ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-center text-sm text-alert">
                        Unable to load arrivals. Pull to retry.
                    </p>
                </div>
            ) : loading && arrivals.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Loading arrivals…
                    </p>
                </div>
            ) : arrivals.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No upcoming arrivals right now.
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {arrivals.map((arrival, i) => (
                        <div
                            key={`${arrival.tripId}-${arrival.stopSequence ?? i}`}
                            data-sheet-row
                            className={`flex items-center gap-3 rounded-xl p-3 ${i === 0 ? 'bg-primary/5' : ''}`}
                        >
                            <span className="flex h-8 min-w-11 items-center justify-center rounded-md bg-primary px-2 text-xs font-bold text-white">
                                {arrival.route}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {arrival.destination}
                            </p>
                            <div className="flex flex-col items-end">
                                <span
                                    className={`text-base font-bold ${i === 0 ? 'text-primary' : ''}`}
                                >
                                    {formatArrival(arrival.minutes)}
                                </span>
                                {arrival.live ? (
                                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                        <span className="relative flex size-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                                        </span>
                                        Live
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                                        Scheduled
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export const SNAP_POINTS = [0, 0.5, 0.9]
export const PREVIEW_SNAP_POINT = SNAP_POINTS[1]
export const MAX_SNAP_POINT = SNAP_POINTS[SNAP_POINTS.length - 1]

export function HomeSheet({
    activeSnapPoint,
    onSnapPointChange,
    nearbyStops,
    selectedStop,
    onSelectStop,
}: {
    activeSnapPoint: number | string | null
    onSnapPointChange: (snapPoint: number | string | null) => void
    nearbyStops: Stop[]
    selectedStop: Stop | null
    onSelectStop: (stop: Stop | null) => void
}) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [hasHidden, setHasHidden] = useState(false)
    const isExpanded = activeSnapPoint === MAX_SNAP_POINT

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const measure = () => {
            const lastRow = el.querySelector<HTMLElement>(
                '[data-sheet-row]:last-of-type'
            )
            if (!lastRow) {
                setHasHidden(false)
                return
            }
            const rowBottom = lastRow.getBoundingClientRect().bottom
            setHasHidden(rowBottom > window.innerHeight - 64)
        }
        const id = setTimeout(measure, 350)
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        window.addEventListener('resize', measure)

        return () => {
            clearTimeout(id)
            ro.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [activeSnapPoint, nearbyStops, selectedStop])

    return (
        <Drawer
            open
            onOpenChange={(next) => {
                if (!next) onSnapPointChange(0)
            }}
            snapPoints={SNAP_POINTS}
            activeSnapPoint={activeSnapPoint}
            setActiveSnapPoint={onSnapPointChange}
            modal={false}
            dismissible
        >
            <DrawerContent className="mx-auto max-w-md z-30">
                <DrawerTitle className="sr-only">Where to?</DrawerTitle>
                <DrawerDescription className="sr-only">
                    Search a destination or pick a nearby stop
                </DrawerDescription>

                {!isExpanded && hasHidden && (
                    <button
                        type="button"
                        onClick={() => onSnapPointChange(MAX_SNAP_POINT)}
                        className="mx-auto mt-2 mb-1 flex shrink-0 items-center justify-center gap-1 text-xs font-semibold text-primary"
                    >
                        <ChevronUp className="size-3.5 animate-nudge-up" />
                        Pull up for more
                    </button>
                )}

                <div
                    ref={scrollRef}
                    className={cn(
                        'scrollbar-hide flex min-h-0 flex-1 flex-col gap-4 overscroll-contain px-4 pt-3 pb-18',
                        isExpanded ? 'overflow-y-auto' : 'overflow-hidden'
                    )}
                >
                    {selectedStop ? (
                        <StopArrivalsPanel
                            stop={selectedStop}
                            onBack={() => onSelectStop(null)}
                        />
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    placeholder="Where to?"
                                    readOnly
                                    className="h-12 rounded-xl border-0 bg-zinc-100 pl-10 caret-transparent dark:bg-zinc-800"
                                />
                            </div>

                            <Tabs defaultValue="nearby">
                                <TabsList className="w-full">
                                    <TabsTrigger value="nearby">
                                        Nearby
                                    </TabsTrigger>
                                    <TabsTrigger value="favourites">
                                        Favourites
                                    </TabsTrigger>
                                    <TabsTrigger value="recent">
                                        Recent
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="nearby">
                                    <StopList
                                        stops={nearbyStops}
                                        onSelect={onSelectStop}
                                    />
                                </TabsContent>
                                <TabsContent value="favourites">
                                    <StopList
                                        stops={FAVOURITE_STOPS}
                                        onSelect={onSelectStop}
                                    />
                                </TabsContent>
                                <TabsContent value="recent">
                                    <StopList
                                        stops={RECENT_STOPS}
                                        onSelect={onSelectStop}
                                    />
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
