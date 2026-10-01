'use client'

/* Thin wrapper over the browser Geolocation API. Exposes the last known
 position, whether permission was denied, and a promise-returning request()
 so callers can await a fresh fix (e.g. when the user taps "Current
 location"). No auto-request on mount — callers decide when to ask.
*/

import { useCallback, useEffect, useState } from 'react'
import { Coords } from '@/types/common'

const OPTIONS: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 15000,
}

export function useGeolocation() {
    const [location, setLocation] = useState<Coords | null>(null)
    const [denied, setDenied] = useState(false)

    // Resolves with coords on success, or null if unavailable/denied. Never
    // rejects, so callers can `const c = await request()` and branch on null.
    const request = useCallback((): Promise<Coords | null> => {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            return Promise.resolve(null)
        }
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    }
                    setDenied(false)
                    setLocation(coords)
                    resolve(coords)
                },
                (err) => {
                    // 1=PERMISSION_DENIED 2=POSITION_UNAVAILABLE 3=TIMEOUT
                    setDenied(err.code === err.PERMISSION_DENIED)
                    resolve(null)
                },
                OPTIONS
            )
        })
    }, [])

    return { location, denied, request }
}

// Follows the user while mounted (e.g. mid-journey on the detail map). Null
// until the first fix, or for good if permission is denied.
export function useWatchedLocation() {
    const [location, setLocation] = useState<Coords | null>(null)

    useEffect(() => {
        if (!('geolocation' in navigator)) return
        const id = navigator.geolocation.watchPosition(
            (pos) =>
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }),
            () => {},
            OPTIONS
        )
        return () => navigator.geolocation.clearWatch(id)
    }, [])

    return location
}
