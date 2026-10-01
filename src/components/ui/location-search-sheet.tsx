'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
    ArrowLeft,
    ChevronRight,
    Clock,
    MapPin,
    Navigation,
    Star,
    X,
} from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { useFavourites } from '@/hooks/useFavourites'
import { useRecent } from '@/hooks/useRecent'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePlacesSearch } from '@/hooks/usePlacesSearch'
import { fetchLocationLabel } from '@/util/reverseGeocode'
import { cn } from '@/lib/utils'
import { Favourite } from '@/types/common'
import { PickedLocation } from '@/types/route'

function Row({
    icon,
    iconClassName,
    title,
    subtitle,
    onClick,
    trailing,
}: {
    icon: ReactNode
    iconClassName?: string
    title: string
    subtitle?: string
    onClick: () => void
    trailing?: ReactNode
}) {
    return (
        <li className="flex items-center gap-1">
            <button
                type="button"
                onClick={onClick}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
                <span
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                        iconClassName
                    )}
                >
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                        {title}
                    </span>
                    {subtitle && (
                        <span className="block truncate text-sm text-zinc-500">
                            {subtitle}
                        </span>
                    )}
                </span>
                {!trailing && (
                    <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                )}
            </button>
            {trailing}
        </li>
    )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-6">
            <h2 className="mb-1 px-2 text-base font-bold">{title}</h2>
            <ul>{children}</ul>
        </section>
    )
}

const subtitleOf = (f: Favourite) =>
    f.placeType === 'stop' ? 'Stop' : undefined

export function LocationSearchSheet({
    open,
    onOpenChange,
    placeholder,
    onSelect,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    placeholder: string
    onSelect: (location: PickedLocation) => void
}) {
    const { favourites, remove } = useFavourites()
    const { recents } = useRecent()
    const { request: requestLocation } = useGeolocation()
    const [query, setQuery] = useState('')
    const [locating, setLocating] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Live Adelaide place search (debounced, session-billed) for the typed query.
    const { predictions, loading: searching, resolve } = usePlacesSearch(query)

    // Clear the query each time the sheet opens.
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) setQuery('')
    }

    // Saved places still filter locally so favourites/recents stay searchable
    // alongside the live Places results.
    const q = query.trim().toLowerCase()
    const match = (f: Favourite) => !q || f.label.toLowerCase().includes(q)
    const favs = favourites.filter(match)
    const recs = recents.filter(match)

    const pick = (location: PickedLocation) => {
        onSelect(location)
        onOpenChange(false)
    }

    // Turn a chosen prediction into coordinates before handing it back.
    const pickPrediction = async (placeId: string) => {
        const place = await resolve(placeId)
        if (place) pick(place)
    }

    // Ask for a location fix, resolve it to an address label, then hand back a
    // coord-backed pick. If denied/unavailable, stay open so the user can
    // search instead. Falls back to "Current location" if the label lookup
    // fails but we still have coords.
    const useCurrentLocation = async () => {
        setLocating(true)
        const coords = await requestLocation()
        if (!coords) {
            setLocating(false)
            return
        }
        const label = await fetchLocationLabel(coords.lat, coords.lng)
        setLocating(false)
        pick({ label: label ?? 'Current location', ...coords })
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            {/* z-[70]: above the fixed nav footer (z-[60]) */}
            <DrawerContent
                showHandle={false}
                className="z-[70] mx-auto max-w-md rounded-none border-0"
            >
                <DrawerTitle className="sr-only">{placeholder}</DrawerTitle>
                <DrawerDescription className="sr-only">
                    Search or pick a saved place
                </DrawerDescription>

                {/* ← closes the sheet, × only clears the query */}
                <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-2 py-3 dark:border-zinc-800">
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => onOpenChange(false)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <input
                        ref={inputRef}
                        type="search"
                        autoFocus
                        value={query}
                        onChange={(e) =>
                            // English only: strip anything outside basic Latin
                            // letters/digits and common address punctuation
                            setQuery(
                                e.target.value.replace(
                                    /[^a-zA-Z0-9\s,.'&/-]/g,
                                    ''
                                )
                            )
                        }
                        inputMode="search"
                        lang="en"
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => {
                                setQuery('')
                                inputRef.current?.focus()
                            }}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <X className="size-5" />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-3 pt-3 pb-8">
                    {!q && (
                        <ul>
                            <Row
                                icon={<Navigation className="size-[18px]" />}
                                iconClassName="bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent"
                                title={
                                    locating
                                        ? 'Getting your location…'
                                        : 'Current location'
                                }
                                onClick={useCurrentLocation}
                            />
                        </ul>
                    )}

                    {favs.length > 0 && (
                        <Section title="Favourites">
                            {favs.map((f) => (
                                <Row
                                    key={`${f.placeType}:${f.placeId}`}
                                    icon={
                                        <Star className="size-[18px] fill-accent text-accent" />
                                    }
                                    title={f.label}
                                    subtitle={subtitleOf(f)}
                                    onClick={() => pick(f)}
                                    trailing={
                                        <button
                                            type="button"
                                            aria-label={`Remove ${f.label} from favourites`}
                                            onClick={() =>
                                                remove(f.placeType, f.placeId)
                                            }
                                            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        >
                                            <Star className="size-5 fill-accent text-accent" />
                                        </button>
                                    }
                                />
                            ))}
                        </Section>
                    )}

                    {recs.length > 0 && (
                        <Section title="Recent">
                            {recs.map((r) => (
                                <Row
                                    key={`${r.placeType}:${r.placeId}`}
                                    icon={<Clock className="size-[18px]" />}
                                    title={r.label}
                                    subtitle={subtitleOf(r)}
                                    onClick={() => pick(r)}
                                />
                            ))}
                        </Section>
                    )}

                    {q && predictions.length > 0 && (
                        <Section title="Places">
                            {predictions.map((p) => (
                                <Row
                                    key={p.placeId}
                                    icon={<MapPin className="size-[18px]" />}
                                    title={p.mainText ?? p.description}
                                    subtitle={p.secondaryText ?? undefined}
                                    onClick={() => pickPrediction(p.placeId)}
                                />
                            ))}
                        </Section>
                    )}

                    {q &&
                        !searching &&
                        predictions.length === 0 &&
                        favs.length === 0 &&
                        recs.length === 0 && (
                            <p className="px-2 py-10 text-center text-sm text-zinc-500">
                                No places in Adelaide match “{query.trim()}”
                            </p>
                        )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
