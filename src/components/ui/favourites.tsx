'use client'

import { useRouter } from 'next/navigation'
import { MapPin, Star } from 'lucide-react'
import { Popover } from 'radix-ui'
import { cn } from '@/lib/utils'
import { FAVOURITE_ICONS } from '@/util/favouriteIcon'
import { useFavourites } from '@/hooks/useFavourites'
import { routeUrl } from '@/util/route'
import { toPlaceFavourite } from '@/util/favourite'
import type {
    Favourite,
    FavouriteIcon,
    Stop,
    PickedLocation,
} from '@/types/place'
import { STOP_MODE_STYLE } from '@/util/stopMode'
import { ListRow } from '@/components/ui/list-row'
import { EmptyState } from '@/components/ui/empty-state'
import { FavouriteStarButton } from '@/components/ui/favourite-star'

const toStop = (f: Favourite): Stop => ({
    id: f.placeId,
    name: f.label,
    code: f.code ?? null,
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

// The place's icon; tap it to pick Home, School, ...
const PlaceIconPicker = ({ place }: { place: Favourite }) => {
    const { setIcon } = useFavourites()
    const current = place.icon ? FAVOURITE_ICONS[place.icon] : null
    const Icon = current?.Icon ?? MapPin
    const choose = (icon: FavouriteIcon | null) =>
        setIcon('place', place.placeId, icon)
    return (
        <Popover.Root>
            <Popover.Trigger
                aria-label={`Change icon for ${place.label}`}
                className="flex size-8 items-center justify-center rounded-full bg-alert/10 text-alert transition-transform active:scale-90"
            >
                <Icon className="size-4" />
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-[95] grid grid-cols-4 gap-1 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                >
                    {(
                        [
                            [null, { Icon: MapPin, label: 'Pin' }],
                            ...Object.entries(FAVOURITE_ICONS),
                        ] as [
                            FavouriteIcon | null,
                            (typeof FAVOURITE_ICONS)[FavouriteIcon],
                        ][]
                    ).map(([key, { Icon, label }]) => (
                        <Popover.Close
                            key={key ?? 'pin'}
                            aria-label={label}
                            aria-pressed={(place.icon ?? null) === key}
                            onClick={() => choose(key)}
                            className={cn(
                                'flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                                (place.icon ?? null) === key &&
                                    'bg-alert/10 text-alert hover:bg-alert/10'
                            )}
                        >
                            <Icon className="size-5" />
                            {label}
                        </Popover.Close>
                    ))}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}

const PlaceRow = ({ place }: { place: Favourite }) => {
    const router = useRouter()
    const { remove } = useFavourites()
    return (
        <ListRow
            leading={<PlaceIconPicker place={place} />}
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
            subtitle={stop.code ? `Stop ${stop.code}` : 'Saved stop'}
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
