'use client'

/* Fetches transit journeys from /api/directions whenever both endpoints are
set, and refreshes on an interval so the countdown and live delays stay
current (the displayed minutes come straight from the server snapshot — no
local ticking, which would drift to "Due" and then jump when a fresh
prediction arrives). A request-sequence guard drops stale responses.
*/

import { useEffect, useRef, useState } from 'react'
import { PickedLocation, Journey } from '@/types/route'

const REFRESH_MS = 30_000 // 30 seconds

export function useDirections(
    origin: PickedLocation,
    destination: PickedLocation
) {
    const [journeys, setJourneys] = useState<Journey[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reqSeq = useRef(0)

    // Depend on the coordinates, not object identity, so a re-created object
    // with the same location doesn't trigger a redundant fetch.
    const oLat = origin?.lat ?? null
    const oLng = origin?.lng ?? null
    const dLat = destination?.lat ?? null
    const dLng = destination?.lng ?? null

    // Expose a manual refresh that behaves like the initial load (shows the
    // spinner, clears stale error). Stored in a ref so the stable function
    // identity isn't tied to the effect's closure.
    const runRef = useRef<((bg: boolean) => void) | null>(null)
    const refresh = () => runRef.current?.(false)

    useEffect(() => {
        if (oLat == null || dLat == null || !origin || !destination) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setJourneys([])
            setError(null)
            return
        }

        // `fetchDataBackground` refreshes skip the loading state so the list doesn't
        // flicker every minute; only the first load shows the spinner.
        const run = (fetchDataBackground: boolean) => {
            const seq = ++reqSeq.current
            const controller = new AbortController()
            if (!fetchDataBackground) {
                setLoading(true)
                setError(null)
            }

            fetch('/api/directions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination }),
                signal: controller.signal,
            })
                .then((res) => res.json())
                .then((data) => {
                    if (seq !== reqSeq.current) return
                    setJourneys(data.journeys ?? [])
                    setError(
                        (data.journeys ?? []).length === 0
                            ? 'No transit routes found for this trip.'
                            : null
                    )
                })
                .catch(() => {
                    // Keep the last good results on a background failure.
                    if (seq === reqSeq.current && !fetchDataBackground) {
                        setJourneys([])
                        setError('Could not load routes. Try again.')
                    }
                })
                .finally(() => {
                    if (seq === reqSeq.current && !fetchDataBackground)
                        setLoading(false)
                })

            return controller
        }

        runRef.current = run
        const initial = run(false)
        const timer = setInterval(() => run(true), REFRESH_MS)

        return () => {
            initial?.abort()
            clearInterval(timer)
            runRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [oLat, oLng, dLat, dLng])

    return { journeys, loading, error, refresh }
}
