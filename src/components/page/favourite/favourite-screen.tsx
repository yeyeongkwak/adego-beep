'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StopArrivalsPanel } from '@/components/ui/home'
import { FavouritePlaces, FavouriteStops } from '@/components/ui/favourites'
import type { Stop } from '@/types/place'

export function FavouriteScreen() {
    const [stop, setStop] = useState<Stop | null>(null)
    const [tab, setTab] = useState('places')

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="shrink-0 bg-primary px-4 pt-4 pb-3">
                <h1 className="text-lg font-bold text-white">Favourites</h1>
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
                {stop ? (
                    <StopArrivalsPanel
                        stop={stop}
                        onBack={() => setStop(null)}
                        isExpanded
                    />
                ) : (
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList className="w-full">
                            <TabsTrigger value="places">Places</TabsTrigger>
                            <TabsTrigger value="stops">Stops</TabsTrigger>
                        </TabsList>
                        <TabsContent value="places">
                            <FavouritePlaces />
                        </TabsContent>
                        <TabsContent value="stops">
                            <FavouriteStops onSelect={setStop} />
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    )
}
