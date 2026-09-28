'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, Omega, Search } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Stop } from '@/types/common'
import { StopList, StopArrivalsPanel } from '@/components/ui/home'

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
                            isExpanded={isExpanded}
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
                                    {/* <FavouritesList /> */}
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
