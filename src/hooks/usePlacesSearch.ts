'use client'

/*
Adelaide-restricted place search over our /api/places proxy routes.
 Billing: Google charges an autocomplete "session" as the keystroke run plus
the final Details lookup, tied together by one sessionToken. 
We mint a token (crypto.randomUUID) lazily, send it with every autocomplete + the details call,
then discard it after a selection so the next search starts fresh.
Requests are debounced, and each fetch is tagged 
so a slow earlier response can't overwrite the results of a newer query.
*/

import { useCallback, useEffect, useRef, useState } from 'react'

export type Prediction = {
    placeId: string
    description: string
    mainText: string | null
    secondaryText: string | null
}
export type ResolvedPlace = { label: string; lat: number; lng: number }

const DEBOUNCE_MS = 300

export function usePlacesSearch(query: string) {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [loading, setLoading] = useState(false)

    const sessionToken = useRef<string | null>(null)
    // Monotonic id so only the latest autocomplete response is applied.
    const reqSeq = useRef(0)

    const ensureToken = () => {
        if (!sessionToken.current) sessionToken.current = crypto.randomUUID()
        return sessionToken.current
    }

    useEffect(() => {
        const q = query.trim()
        const seq = ++reqSeq.current

        /* Debounced remote search is a legitimate effect: the query is external
         input we synchronise to server results. The set-state-in-effect rule
         is aimed at cascading-render loops, which don't apply here (state is
         set once per query, guarded by seq), so we opt out on the two direct
         calls below rather than obscuring the flow.
        */
        if (!q) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPredictions([])
            setLoading(false)
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/places/autocomplete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: q,
                        sessionToken: ensureToken(),
                    }),
                })
                const data = await res.json()
                // Ignore if a newer query has since fired.
                if (seq !== reqSeq.current) return
                setPredictions(data.predictions ?? [])
            } catch {
                if (seq === reqSeq.current) setPredictions([])
            } finally {
                if (seq === reqSeq.current) setLoading(false)
            }
        }, DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [query])

    // Resolve a prediction to coordinates, closing the billing session.
    const resolve = useCallback(
        async (placeId: string): Promise<ResolvedPlace | null> => {
            const token = sessionToken.current ?? ''
            try {
                const res = await fetch(
                    `/api/places/details?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(token)}`
                )
                if (!res.ok) return null
                const data = await res.json()
                if (typeof data.lat !== 'number') return null
                return { label: data.label, lat: data.lat, lng: data.lng }
            } finally {
                // Session ends after Details; next search gets a new token.
                sessionToken.current = null
            }
        },
        []
    )

    return { predictions, loading, resolve }
}
