'use client'

// Recently viewed stops. localStorage-only for now (same storage-agnostic shape
// as useFavourites, so a signed-in DB branch can slot in later untouched).
//
// Differs from favourites: entries are recorded automatically when a stop is
// opened (not toggled), kept newest-first, de-duplicated by identity, and
// capped so the list stays short. Backed by useSyncExternalStore so all
// instances share one source of truth.

import { useCallback, useSyncExternalStore } from 'react'
import type { Recent } from '@/types/common'
import { createLocalListStore, placeKey } from '@/util/localStore'

const MAX_RECENTS = 10

const store = createLocalListStore<Recent>('adego:recent')

export function useRecent() {
    const recents = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    )

    // Record a visit: drop any existing entry for the same place, prepend the
    // fresh one, and cap the list. Call when a stop's arrivals are opened.
    const record = useCallback((item: Omit<Recent, 'visitedAt'>) => {
        const k = placeKey(item.placeType, item.placeId)
        const withoutDupe = store
            .getSnapshot()
            .filter((r) => placeKey(r.placeType, r.placeId) !== k)
        store.write(
            [{ ...item, visitedAt: Date.now() }, ...withoutDupe].slice(
                0,
                MAX_RECENTS
            )
        )
    }, [])

    const remove = useCallback(
        (placeType: Recent['placeType'], placeId: string) => {
            const k = placeKey(placeType, placeId)
            store.write(
                store
                    .getSnapshot()
                    .filter((r) => placeKey(r.placeType, r.placeId) !== k)
            )
        },
        []
    )

    const clear = useCallback(() => store.write([]), [])

    return { recents, record, remove, clear }
}
