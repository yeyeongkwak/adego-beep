'use client'

// Favourites store. localStorage-only for now so it works without auth. The
// public API (favourites / isFavourite / toggle / remove) is storage-agnostic:
// once Google auth lands, add a signed-in branch that hits /api/favourites (the
// favorite_locations table) and the UI won't change.
//
// Backed by useSyncExternalStore so every hook instance (list rows, arrivals
// header) reads one source of truth and updates together — a toggle in one
// place instantly reflects everywhere, plus cross-tab sync.

import { useCallback, useSyncExternalStore } from 'react'
import type { Favourite } from '@/types/common'
import { createLocalListStore, placeKey } from '@/util/localStore'

const store = createLocalListStore<Favourite>('adego:favourites')

export function useFavourites() {
    const favourites = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    )

    const isFavourite = useCallback(
        (placeType: Favourite['placeType'], placeId: string): boolean =>
            favourites.some(
                (f) =>
                    placeKey(f.placeType, f.placeId) ===
                    placeKey(placeType, placeId)
            ),
        [favourites]
    )

    // Add if absent, remove if present. Returns the new favourited state.
    const toggle = useCallback((item: Favourite): boolean => {
        const current = store.getSnapshot()
        const k = placeKey(item.placeType, item.placeId)
        const exists = current.some(
            (f) => placeKey(f.placeType, f.placeId) === k
        )
        store.write(
            exists
                ? current.filter((f) => placeKey(f.placeType, f.placeId) !== k)
                : [...current, item]
        )
        return !exists
    }, [])

    const remove = useCallback(
        (placeType: Favourite['placeType'], placeId: string) => {
            const k = placeKey(placeType, placeId)
            store.write(
                store
                    .getSnapshot()
                    .filter((f) => placeKey(f.placeType, f.placeId) !== k)
            )
        },
        []
    )

    return { favourites, isFavourite, toggle, remove }
}
