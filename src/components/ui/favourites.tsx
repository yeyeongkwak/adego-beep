'use client'

import { useRouter } from 'next/navigation'
import { MapPin, Star } from 'lucide-react'
import { useFavourites } from '@/hooks/useFavourites'
import { useStopArrival } from '@/hooks/useStopArrival'
import { formatArrival } from '@/util/arrival'
import { routeUrl } from '@/util/route'
import { toPlaceFavourite } from '@/util/favourite'
import type { Favourite, Stop, PickedLocation } from '@/types/place'
import { STOP_MODE_STYLE } from '@/util/stopMode'
import { ListRow } from '@/components/ui/list-row'
import { EmptyState } from '@/components/ui/empty-state'
import { FavouriteStarButton } from '@/components/ui/favourite-star'

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
        <FavouriteStarButton
            favourited={favourited}
            label={
                favourited
                    ? `Remove ${place.label} from favourites`
                    : `Add ${place.label} to favourites`
            }
            onClick={() => toggle(favourite)}
            className="size-10"
        />
    )
}

const PlaceRow = ({ place }: { place: Favourite }) => {
    const router = useRouter()
    const { remove } = useFavourites()
    return (
        <ListRow
            icon={<MapPin className="size-4 text-alert" />}
            iconClass="bg-alert/10"
            title={place.label}
            subtitle="Find a route from here"
            onClick={() => router.push(routeUrl(place))}
            trailing={
                <FavouriteStarButton
                    favourited
                    label={`Remove ${place.label} from favourites`}
                    onClick={() => remove('place', place.placeId)}
                />
            }
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
        <ListRow
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
            trailing={
                <FavouriteStarButton
                    favourited
                    label={`Remove ${stop.label} from favourites`}
                    onClick={() => remove('stop', stop.placeId)}
                />
            }
        />
    )
}

export const FavouritePlaces = () => {
    const { favourites } = useFavourites()
    const places = favourites.filter((f) => f.placeType === 'place')
    if (places.length === 0) {
        return (
            <EmptyState
                icon={<Star className="size-6" />}
                title="No saved places yet"
                description="Search a destination and tap the star to keep it here."
                className="flex-1 justify-center py-0"
            />
        )
    }
    return (
        <ul className="space-y-0.5">
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
        return (
            <EmptyState
                icon={<Star className="size-6" />}
                title="No saved stops yet"
                description="Tap the star on a nearby stop to pin it for next time."
                className="flex-1 justify-center py-0"
            />
        )
    }
    return (
        <ul className="space-y-0.5">
            {stops.map((s) => (
                <StopRow key={s.placeId} stop={s} onSelect={onSelect} />
            ))}
        </ul>
    )
}

export const FavouritesList = ({
    onSelectStop,
}: {
    onSelectStop: (stop: Stop) => void
}) => {
    const { favourites } = useFavourites()
    if (favourites.length === 0) {
        return (
            <EmptyState
                icon={<Star className="size-6" />}
                title="Nothing saved yet"
                description="Star a stop or destination and it will show up here."
                className="py-10"
            />
        )
    }
    const hasPlaces = favourites.some((f) => f.placeType === 'place')
    const hasStops = favourites.some((f) => f.placeType === 'stop')
    return (
        <div className="space-y-4">
            {hasPlaces && (
                <section>
                    <h2 className="mb-1 px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Places
                    </h2>
                    <FavouritePlaces />
                </section>
            )}
            {hasStops && (
                <section>
                    <h2 className="mb-1 px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Stops
                    </h2>
                    <FavouriteStops onSelect={onSelectStop} />
                </section>
            )}
        </div>
    )
}
