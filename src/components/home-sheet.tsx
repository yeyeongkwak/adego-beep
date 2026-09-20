'use client'

import { BusFront, MapPin, Search, TrainFront, TramFront } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type StopMode = 'BUS' | 'TRAM' | 'RAIL'
export type Stop = {
    id: string
    name: string
    code: string | null
    lat: number
    lng: number
    distanceM?: number
    mode?: StopMode
}

const STOP_MODE_STYLE: Record<
    StopMode,
    { icon: typeof BusFront; iconClass: string; bgClass: string }
> = {
    BUS: {
        icon: BusFront,
        iconClass: 'text-primary',
        bgClass: 'bg-primary/10',
    },
    TRAM: {
        icon: TramFront,
        iconClass: 'text-accent',
        bgClass: 'bg-accent/10',
    },
    RAIL: { icon: TrainFront, iconClass: 'text-alert', bgClass: 'bg-alert/10' },
}

// Mock data — placeholder until auth-backed favourites/history replace these.
// Nearby now comes from a real GTFS proximity query, passed in as a prop.
const FAVOURITE_STOPS: Stop[] = [
    { id: 'fav-1', name: 'King William St', code: 'KWS001', lat: -34.9285, lng: 138.6007 },
    { id: 'fav-2', name: 'University of Adelaide', code: 'UNIV01', lat: -34.9205, lng: 138.6045 },
]
const RECENT_STOPS: Stop[] = [
    { id: 'rec-1', name: 'Henley Beach', code: 'HEN01', lat: -34.9161, lng: 138.4964 },
    { id: 'rec-2', name: 'Glenelg', code: 'GLE01', lat: -34.9805, lng: 138.5156 },
]

function StopRow({ name, code, distanceM, mode }: Stop) {
    const style = mode ? STOP_MODE_STYLE[mode] : null
    const Icon = style?.icon ?? MapPin
    return (
        <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-xl p-3"
        >
            <div
                className={`rounded-full p-2 ${style?.bgClass ?? 'bg-zinc-100 dark:bg-zinc-800'}`}
            >
                <Icon
                    className={`size-4 ${style?.iconClass ?? 'text-primary'}`}
                />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {code ? `Stop ${code}` : 'Stop'}
                    {distanceM != null ? ` · ${distanceM}m` : ''}
                </p>
            </div>
        </Button>
    )
}

function StopList({ stops }: { stops: Stop[] }) {
    if (stops.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nothing here yet.
            </p>
        )
    }
    return (
        <div className="space-y-1">
            {stops.map((stop) => (
                <StopRow key={stop.id} {...stop} />
            ))}
        </div>
    )
}

export function HomeSheet({
    activeSnapPoint,
    onSnapPointChange,
    nearbyStops,
}: {
    activeSnapPoint: number | string | null
    onSnapPointChange: (snapPoint: number | string | null) => void
    nearbyStops: Stop[]
}) {
    return (
        <Drawer
            // open is always true => "closed" is expressed via snapPoint 0, not open=false.
            // vaul only calls onOpenChange(false) on a fast flick;
            // redirect it into snapPoint 0 so activeSnapPoint stays the single source of truth.
            open
            onOpenChange={(next) => {
                if (!next) onSnapPointChange(0)
            }}
            snapPoints={[0, 0.5, 0.7]}
            activeSnapPoint={activeSnapPoint}
            setActiveSnapPoint={onSnapPointChange}
            modal={false}
            dismissible
        >
            <DrawerContent className="mx-auto max-w-md">
                <DrawerTitle className="sr-only">Where to?</DrawerTitle>
                <DrawerDescription className="sr-only">
                    Search a destination or pick a nearby stop
                </DrawerDescription>

                <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-6">
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
                            <TabsTrigger value="nearby">Nearby</TabsTrigger>
                            <TabsTrigger value="favourites">
                                Favourites
                            </TabsTrigger>
                            <TabsTrigger value="recent">Recent</TabsTrigger>
                        </TabsList>
                        <TabsContent value="nearby">
                            <StopList stops={nearbyStops} />
                        </TabsContent>
                        <TabsContent value="favourites">
                            <StopList stops={FAVOURITE_STOPS} />
                        </TabsContent>
                        <TabsContent value="recent">
                            <StopList stops={RECENT_STOPS} />
                        </TabsContent>
                    </Tabs>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
