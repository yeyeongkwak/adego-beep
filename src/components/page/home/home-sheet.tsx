'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, Search } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Stop, PickedLocation } from '@/types/place'
import { StopList, StopArrivalsPanel } from '@/components/ui/home'
import { FavouritesList } from '@/components/ui/favourites'
import { LocationSearchSheet } from '@/components/ui/location-search-sheet'
import { routeUrl } from '@/util/route'

export const SNAP_POINTS = [0, 0.5, 0.9]
export const PREVIEW_SNAP_POINT = SNAP_POINTS[1]
export const MAX_SNAP_POINT = SNAP_POINTS[SNAP_POINTS.length - 1]

// Low-velocity drags (mouse / careful touch) otherwise bounce to the closest
// snap. A short pull is enough to step; applied after vaul so we win the race.
const SNAP_STEP_PX = 28

export function HomeSheet({
    activeSnapPoint,
    onSnapPointChange,
    nearbyStops,
    nearbyLoading = false,
    selectedStop,
    onSelectStop,
}: {
    activeSnapPoint: number | string | null
    onSnapPointChange: (snapPoint: number | string | null) => void
    nearbyStops: Stop[]
    nearbyLoading?: boolean
    selectedStop: Stop | null
    onSelectStop: (stop: Stop | null) => void
}) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const dragStartY = useRef<number | null>(null)
    const dragStartSnap = useRef<number | string | null>(null)
    const [hasHidden, setHasHidden] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const router = useRouter()

    const stepSnapFromDrag = (endY: number) => {
        if (dragStartY.current == null) return
        const dy = endY - dragStartY.current
        const from = dragStartSnap.current
        dragStartY.current = null
        dragStartSnap.current = null
        if (typeof from !== 'number') return
        const idx = SNAP_POINTS.indexOf(from)
        if (idx < 0) return
        let next: number | null = null
        if (dy > SNAP_STEP_PX && idx > 0) next = SNAP_POINTS[idx - 1]
        else if (dy < -SNAP_STEP_PX && idx < SNAP_POINTS.length - 1)
            next = SNAP_POINTS[idx + 1]
        if (next == null) return
        // Vaul may have already snapped back to `from`; override on next tick.
        setTimeout(() => onSnapPointChange(next), 0)
    }

    // Picking a destination from search jumps to the route planner with that
    // place preset as the destination.
    const goToRoute = (place: PickedLocation) => {
        if (place) router.push(routeUrl(place))
    }

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
        measure()
        const id = setTimeout(measure, 350)
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        const mo = new MutationObserver(measure)
        mo.observe(el, { childList: true, subtree: true })
        window.addEventListener('resize', measure)

        return () => {
            clearTimeout(id)
            ro.disconnect()
            mo.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [activeSnapPoint, nearbyStops, selectedStop])

    return (
        <>
            <Drawer
                open
                onOpenChange={(next) => {
                    // Stay mounted; snap 0 is the collapsed state.
                    if (!next) onSnapPointChange(0)
                }}
                snapPoints={SNAP_POINTS}
                activeSnapPoint={activeSnapPoint}
                setActiveSnapPoint={onSnapPointChange}
                modal={false}
                // Always-open home sheet: vaul's iOS body{position:fixed}
                // makes the map look foggy in Add-to-Home-Screen / Safari.
                noBodyStyles
                // open is always true — dismissible would fight that and bounce.
                dismissible={false}
                // One snap per gesture (0.9 → 0.5 → 0), no velocity skips.
                snapToSequentialPoint
                scrollLockTimeout={0}
                onDrag={(e) => {
                    if (!('clientY' in e)) return
                    if (dragStartY.current == null) {
                        dragStartY.current = e.clientY
                        dragStartSnap.current = activeSnapPoint
                    }
                }}
                onRelease={(e) => {
                    if ('clientY' in e) stepSnapFromDrag(e.clientY)
                    else {
                        dragStartY.current = null
                        dragStartSnap.current = null
                    }
                }}
            >
                <DrawerContent
                    showOverlay={false}
                    // Full-height drawer is translated for snaps; without this
                    // the invisible upper area still eats map/banner taps.
                    className="pointer-events-none z-30 mx-auto max-w-md [&_[data-vaul-handle]]:pointer-events-auto [&_[data-vaul-handle-hitarea]]:pointer-events-auto"
                >
                    <DrawerTitle className="sr-only">Where to?</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        Search a destination or pick a nearby stop
                    </DrawerDescription>

                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
                        {!isExpanded && hasHidden && (
                            <button
                                type="button"
                                onClick={() =>
                                    onSnapPointChange(MAX_SNAP_POINT)
                                }
                                className="mx-auto mt-2 mb-1 flex shrink-0 items-center justify-center gap-1 text-xs font-semibold text-primary"
                            >
                                <ChevronUp className="size-3.5 animate-nudge-up" />
                                Pull up for more
                            </button>
                        )}

                        {selectedStop ? (
                            <div
                                ref={scrollRef}
                                className="relative min-h-0 flex-1 overflow-hidden"
                                style={{
                                    height:
                                        typeof activeSnapPoint === 'number'
                                            ? `${activeSnapPoint * 100}dvh`
                                            : '50dvh',
                                }}
                            >
                                <div className="absolute inset-x-0 top-0 flex h-full flex-col px-4 pt-3 pb-18">
                                    <StopArrivalsPanel
                                        stop={selectedStop}
                                        onBack={() => onSelectStop(null)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <Tabs
                                defaultValue="nearby"
                                className="flex min-h-0 flex-1 flex-col"
                            >
                                {/* Outside the scroll area so drag here always moves the sheet. */}
                                <div className="flex shrink-0 flex-col gap-4 px-4 pt-3">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                                        <Input
                                            placeholder="Where to?"
                                            readOnly
                                            onClick={() => setSearchOpen(true)}
                                            className="h-12 cursor-pointer rounded-xl border-0 bg-zinc-100 pl-10 caret-transparent dark:bg-zinc-800"
                                        />
                                    </div>
                                    <TabsList className="w-full">
                                        <TabsTrigger value="nearby">
                                            Nearby
                                        </TabsTrigger>
                                        <TabsTrigger value="favourites">
                                            Favourites
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <div
                                    ref={scrollRef}
                                    className={cn(
                                        'scrollbar-hide min-h-0 flex-1 overscroll-contain px-4 pt-4 pb-18',
                                        isExpanded
                                            ? 'overflow-y-auto'
                                            : 'overflow-hidden'
                                    )}
                                >
                                    <TabsContent value="nearby">
                                        <StopList
                                            stops={nearbyStops}
                                            loading={nearbyLoading}
                                            onSelect={onSelectStop}
                                        />
                                    </TabsContent>
                                    <TabsContent value="favourites">
                                        <FavouritesList
                                            onSelectStop={onSelectStop}
                                        />
                                    </TabsContent>
                                </div>
                            </Tabs>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>

            <LocationSearchSheet
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder="Where to?"
                onSelect={goToRoute}
            />
        </>
    )
}
