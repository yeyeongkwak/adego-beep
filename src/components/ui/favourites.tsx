'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Star } from 'lucide-react'
import { useFavourites } from '@/hooks/useFavourites'
import { useStopArrival } from '@/hooks/useStopArrival'
import { formatArrival } from '@/util/arrival'
import { routeUrl } from '@/util/route'
import { toPlaceFavourite } from '@/util/favourite'
import type { Favourite, Stop, PickedLocation } from '@/types/place'
import { STOP_MODE_STYLE } from '@/util/stopMode'

const toStop = (f: Favourite): Stop => ({
    id: f.placeId,
    name: f.label,
    code: null,
    lat: f.lat,
    lng: f.lng,
    mode: f.mode,
})

export const FavouritePlaceButton = ({
    place,
}: {
    place: NonNullable<PickedLocation>
}) => {
    const { isFavourite, toggle } = useFavourites()
    const favourite = toPlaceFavourite(place)
    const favourited = isFavourite('place', favourite.placeId)
    return (
        <button
            type="button"
            aria-label={
                favourited
                    ? `Remove ${place.label} from favourites`
                    : `Add ${place.label} to favourites`
            }
            aria-pressed={favourited}
            onClick={() => toggle(favourite)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
            <Star
                className={
                    favourited
                        ? 'size-4 fill-accent text-accent'
                        : 'size-4 text-zinc-400'
                }
            />
        </button>
    )
}

const Row = ({
    icon,
    iconClass,
    title,
    subtitle,
    onClick,
    onRemove,
}: {
    icon: ReactNode
    iconClass: string
    title: string
    subtitle: ReactNode
    onClick: () => void
    onRemove: () => void
}) => (
    <li className="flex items-center gap-1" data-sheet-row>
        <button
            type="button"
            onClick={onClick}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
            <span className={`shrink-0 rounded-full p-2 ${iconClass}`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                    {title}
                </span>
                <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {subtitle}
                </span>
            </span>
        </button>
        <button
            type="button"
            aria-label={`Remove ${title} from favourites`}
            onClick={onRemove}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
            <Star className="size-4 fill-accent text-accent" />
        </button>
    </li>
)

const PlaceRow = ({ place }: { place: Favourite }) => {
    const router = useRouter()
    const { remove } = useFavourites()
    return (
        <Row
            icon={<MapPin className="size-4 text-alert" />}
            iconClass="bg-alert/10"
            title={place.label}
            subtitle="Find a route from here"
            onClick={() => router.push(routeUrl(place))}
            onRemove={() => remove('place', place.placeId)}
        />
    )
}

const StopRow = ({
    stop,
    onSelect,
}: {
    stop: Favourite
    onSelect: (stop: Stop) => void
}) => {
    const { remove } = useFavourites()
    const { arrivals, loading } = useStopArrival(stop.placeId)
    const next = arrivals.filter((a) => !a.cancelled).slice(0, 3)
    const style = stop.mode ? STOP_MODE_STYLE[stop.mode] : null
    const Icon = style?.icon ?? MapPin
    return (
        <Row
            icon={
                <Icon
                    className={`size-4 ${style?.iconClass ?? 'text-primary'}`}
                />
            }
            iconClass={style?.bgClass ?? 'bg-zinc-100 dark:bg-zinc-800'}
            title={stop.label}
            subtitle={
                next.length > 0
                    ? next
                          .map((a) => `${a.route} ${formatArrival(a.minutes)}`)
                          .join(' · ')
                    : loading
                      ? 'Loading…'
                      : 'No buses soon'
            }
            onClick={() => onSelect(toStop(stop))}
            onRemove={() => remove('stop', stop.placeId)}
        />
    )
}

const Empty = ({ children }: { children: ReactNode }) => (
    <p className="px-2 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {children}
    </p>
)

export const FavouritePlaces = () => {
    const { favourites } = useFavourites()
    const places = favourites.filter((f) => f.placeType === 'place')
    if (places.length === 0) {
        return (
            <Empty>
                No saved places yet. Tap ☆ next to a destination to save it.
            </Empty>
        )
    }
    return (
        <ul className="space-y-1">
            {places.map((p) => (
                <PlaceRow key={p.placeId} place={p} />
            ))}
        </ul>
    )
}

export const FavouriteStops = ({
    onSelect,
}: {
    onSelect: (stop: Stop) => void
}) => {
    const { favourites } = useFavourites()
    const stops = favourites.filter((f) => f.placeType === 'stop')
    if (stops.length === 0) {
        return <Empty>No saved stops yet. Tap ☆ on a stop to save it.</Empty>
    }
    return (
        <ul className="space-y-1">
            {stops.map((s) => (
                <StopRow key={s.placeId} stop={s} onSelect={onSelect} />
            ))}
        </ul>
    )
}

// Home sheet already has tabs, so here places and stops are stacked.
export const FavouritesList = ({
    onSelectStop,
}: {
    onSelectStop: (stop: Stop) => void
}) => {
    const { favourites } = useFavourites()
    if (favourites.length === 0) {
        return (
            <Empty>
                No favourites yet. Tap ☆ on a stop or a destination to save it.
            </Empty>
        )
    }
    const hasPlaces = favourites.some((f) => f.placeType === 'place')
    const hasStops = favourites.some((f) => f.placeType === 'stop')
    return (
        <div className="space-y-4">
            {hasPlaces && (
                <section>
                    <h2 className="mb-1 px-2 text-sm font-bold">Places</h2>
                    <FavouritePlaces />
                </section>
            )}
            {hasStops && (
                <section>
                    <h2 className="mb-1 px-2 text-sm font-bold">Stops</h2>
                    <FavouriteStops onSelect={onSelectStop} />
                </section>
            )}
        </div>
    )
}
