'use client'

// Favourites: localStorage when signed out, /api/favourites when signed in.
// Public API (favourites / isFavourite / toggle / remove) stays the same.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Favourite } from '@/types/place'
import { createLocalListStore, placeKey } from '@/util/localStore'
import { useSession } from '@/hooks/useSession'

const store = createLocalListStore<Favourite>('adego:favourites')
const EMPTY: Favourite[] = []

export function useFavourites() {
    const { user, signedIn } = useSession()
    const queryClient = useQueryClient()
    const queryKey = useMemo(
        () => ['favourites', user?.userId] as const,
        [user?.userId]
    )

    const { data: remote } = useQuery({
        queryKey,
        queryFn: async () => {
            const res = await fetch('/api/favourites')
            if (!res.ok) throw new Error('Failed to fetch favourites')
            const json = (await res.json()) as { favourites: Favourite[] }
            return json.favourites
        },
        enabled: signedIn,
        staleTime: Infinity,
    })

    const local = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    )

    const favourites = signedIn ? (remote ?? EMPTY) : local

    const isFavourite = useCallback(
        (placeType: Favourite['placeType'], placeId: string): boolean =>
            favourites.some(
                (f) =>
                    placeKey(f.placeType, f.placeId) ===
                    placeKey(placeType, placeId)
            ),
        [favourites]
    )

    const remove = useCallback(
        (placeType: Favourite['placeType'], placeId: string) => {
            const k = placeKey(placeType, placeId)
            if (!signedIn) {
                store.write(
                    store
                        .getSnapshot()
                        .filter((f) => placeKey(f.placeType, f.placeId) !== k)
                )
                return
            }
            queryClient.setQueryData<Favourite[]>(queryKey, (current) =>
                (current ?? EMPTY).filter(
                    (f) => placeKey(f.placeType, f.placeId) !== k
                )
            )
            void fetch(
                `/api/favourites?placeType=${encodeURIComponent(placeType)}&placeId=${encodeURIComponent(placeId)}`,
                { method: 'DELETE' }
            ).then((res) => {
                if (!res.ok) void queryClient.invalidateQueries({ queryKey })
            })
        },
        [signedIn, queryClient, queryKey]
    )

    const toggle = useCallback(
        (item: Favourite): boolean => {
            const exists = isFavourite(item.placeType, item.placeId)
            if (exists) {
                remove(item.placeType, item.placeId)
                return false
            }
            if (!signedIn) {
                store.write([...store.getSnapshot(), item])
                return true
            }
            queryClient.setQueryData<Favourite[]>(queryKey, (current) => [
                ...(current ?? EMPTY),
                item,
            ])
            void fetch('/api/favourites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            }).then((res) => {
                if (!res.ok) void queryClient.invalidateQueries({ queryKey })
            })
            return true
        },
        [isFavourite, remove, signedIn, queryClient, queryKey]
    )

    return { favourites, isFavourite, toggle, remove }
}
