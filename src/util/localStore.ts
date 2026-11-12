// localStorage helpers shared by the favourites/recents hooks. SSR-safe
// (no-ops without window) and generic so each caller keeps its own item type.

// Identity for a saved place/stop — the same rule the DB uses (place_type +
// place_id), so records can move between localStorage and the table unchanged.
export function placeKey(placeType: string, placeId: string): string {
    return `${placeType}:${placeId}`
}

function readRaw<T>(storageKey: string): T[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
        return []
    }
}

/* A localStorage-backed list wired for useSyncExternalStore.

getSnapshot must return a STABLE reference between changes, otherwise
useSyncExternalStore re-renders forever. So we cache the last parsed array
and only re-parse when the underlying string actually changed. subscribe
fans out both cross-tab `storage` events and same-tab writes to listeners.
*/

export type LocalListStore<T> = {
    subscribe: (onChange: () => void) => () => void
    getSnapshot: () => T[]
    getServerSnapshot: () => T[]
    write: (items: T[]) => void
}

export function createLocalListStore<T>(storageKey: string): LocalListStore<T> {
    const listeners = new Set<() => void>()
    let cache: T[] = []
    let cacheRaw: string | null = null
    let initialised = false
    const EMPTY: T[] = []

    const emit = () => listeners.forEach((l) => l())

    const getSnapshot = (): T[] => {
        if (typeof window === 'undefined') return EMPTY
        const raw = window.localStorage.getItem(storageKey)
        // Same string as last read -> hand back the cached array (stable ref).
        if (initialised && raw === cacheRaw) return cache
        cacheRaw = raw
        cache = readRaw<T>(storageKey)
        initialised = true
        return cache
    }

    return {
        subscribe: (onChange) => {
            listeners.add(onChange)
            const onStorage = (e: StorageEvent) => {
                if (e.key === storageKey) onChange()
            }
            window.addEventListener('storage', onStorage)
            return () => {
                listeners.delete(onChange)
                window.removeEventListener('storage', onStorage)
            }
        },
        getSnapshot,
        getServerSnapshot: () => EMPTY,
        write: (items) => {
            if (typeof window === 'undefined') return
            window.localStorage.setItem(storageKey, JSON.stringify(items))
            emit()
        },
    }
}
