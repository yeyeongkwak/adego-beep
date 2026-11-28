'use client'

// Recently picked places and opened stops, newest first. localStorage when
// signed out, /api/recents when signed in (same pattern as useFavourites).

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Favourite, Recent } from '@/types/place'
import { createLocalListStore, placeKey } from '@/util/localStore'
import { MAX_RECENTS } from '@/util/recent'
import { useSession } from '@/hooks/useSession'

const store = createLocalListStore<Recent>('adego:recent')
const EMPTY: Recent[] = []

// Put the place first, drop its older entry, and cap the list.
const bump = (list: Recent[], item: Favourite): Recent[] => {
    const k = placeKey(item.placeType, item.placeId)
    return [
        { ...item, visitedAt: Date.now() },
        ...list.filter((r) => placeKey(r.placeType, r.placeId) !== k),
    ].slice(0, MAX_RECENTS)
}

export function useRecent() {
    const { user, signedIn } = useSession()
    const queryClient = useQueryClient()
    const queryKey = useMemo(
        () => ['recents', user?.userId] as const,
        [user?.userId]
    )

    const { data: remote } = useQuery({
        queryKey,
        queryFn: async () => {
            const res = await fetch('/api/recents')
            if (!res.ok) throw new Error('Failed to fetch recents')
            return ((await res.json()) as { recents: Recent[] }).recents
        },
        enabled: signedIn,
        staleTime: Infinity,
    })

    const local = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    )

    const recents = signedIn ? (remote ?? EMPTY) : local

    const record = useCallback(
        (item: Favourite) => {
            // Keep only the place fields (a favourite may carry an icon).
            const { placeType, placeId, label, lat, lng, mode, code } = item
            const place = { placeType, placeId, label, lat, lng, mode, code }
            if (!signedIn) {
                store.write(bump(store.getSnapshot(), place))
                return
            }
            queryClient.setQueryData<Recent[]>(queryKey, (current) =>
                bump(current ?? EMPTY, place)
            )
            void fetch('/api/recents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(place),
            }).then((res) => {
                if (!res.ok) void queryClient.invalidateQueries({ queryKey })
            })
        },
        [signedIn, queryClient, queryKey]
    )

    return { recents, record }
}
