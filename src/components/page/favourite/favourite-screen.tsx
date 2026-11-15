'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StopArrivalsPanel } from '@/components/ui/home'
import { FavouritePlaces, FavouriteStops } from '@/components/ui/favourites'
import { PageHeader } from '@/components/ui/page-header'
import type { Stop } from '@/types/place'

export function FavouriteScreen() {
    const [stop, setStop] = useState<Stop | null>(null)
    const [tab, setTab] = useState('places')

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
            <PageHeader
                title="Favourites"
                subtitle="Places and stops you come back to"
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
                {stop ? (
                    <StopArrivalsPanel
                        stop={stop}
                        onBack={() => setStop(null)}
                    />
                ) : (
                    <Tabs
                        value={tab}
                        onValueChange={setTab}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <TabsList className="w-full shrink-0">
                            <TabsTrigger value="places">Places</TabsTrigger>
                            <TabsTrigger value="stops">Stops</TabsTrigger>
                        </TabsList>
                        <TabsContent
                            value="places"
                            className="fade-rise flex min-h-0 flex-1 flex-col"
                        >
                            <FavouritePlaces />
                        </TabsContent>
                        <TabsContent
                            value="stops"
                            className="fade-rise flex min-h-0 flex-1 flex-col"
                        >
                            <FavouriteStops onSelect={setStop} />
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    )
}
