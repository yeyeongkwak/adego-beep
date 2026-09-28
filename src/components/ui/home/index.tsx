import { Stop } from '@/types/common'
import { MapPin, ArrowLeft, Star } from 'lucide-react'
import { STOP_MODE_STYLE } from '@/types/common'
import { Button } from '@/components/ui/button'
import { useStopArrival } from '@/hooks/useStopArrival'
import { useFavourites } from '@/hooks/useFavourites'
import { formatDistance } from '@/util/map/distance'
import { formatArrival } from '@/util/arrival'

const StopRow = ({
    stop,
    onSelect,
    favourited,
}: {
    stop: Stop
    onSelect: () => void
    favourited: boolean
}) => {
    const { name, code, distanceM, mode } = stop
    const style = mode ? STOP_MODE_STYLE[mode] : null
    const Icon = style?.icon ?? MapPin
    return (
        <Button
            variant="ghost"
            onClick={onSelect}
            data-sheet-row
            className="h-auto w-full justify-start gap-3 rounded-xl p-3"
        >
            <div
                className={`rounded-full p-2 ${style?.bgClass ?? 'bg-zinc-100 dark:bg-zinc-800'}`}
            >
                <Icon
                    className={`size-4 ${style?.iconClass ?? 'text-primary'}`}
                />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {code ? `Stop ${code}` : 'Stop'}
                    {distanceM != null ? ` · ${distanceM}m` : ''}
                </p>
            </div>
            {favourited && (
                <Star className="size-4 shrink-0 fill-accent text-accent" />
            )}
        </Button>
    )
}

export const StopList = ({
    stops,
    onSelect,
}: {
    stops: Stop[]
    onSelect: (stop: Stop) => void
}) => {
    const { isFavourite } = useFavourites()

    if (stops.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading ...
            </p>
        )
    }
    return (
        <div className="space-y-1">
            {stops.map((stop) => (
                <StopRow
                    key={stop.id}
                    stop={stop}
                    onSelect={() => onSelect(stop)}
                    favourited={isFavourite('stop', stop.id)}
                />
            ))}
        </div>
    )
}

export const StopArrivalsPanel = ({
    stop,
    onBack,
    isExpanded,
}: {
    stop: Stop
    onBack: () => void
    isExpanded: boolean
}) => {
    const style = stop.mode ? STOP_MODE_STYLE[stop.mode] : null
    const Icon = style?.icon ?? MapPin
    const { arrivals, loading, error } = useStopArrival(stop.id)

    const { isFavourite, toggle } = useFavourites()
    const favourited = isFavourite('stop', stop.id)
    const toggleFavourite = () =>
        toggle({
            placeType: 'stop',
            placeId: stop.id,
            label: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            mode: stop.mode,
        })

    const statusWrapClass = isExpanded
        ? 'flex flex-1 items-center justify-center px-4'
        : 'px-4 py-10'

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex shrink-0 items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-full"
                    onClick={onBack}
                >
                    <ArrowLeft className="size-5" />
                </Button>
                <div
                    className={`rounded-full p-2.5 ${style?.bgClass ?? 'bg-zinc-100 dark:bg-zinc-800'}`}
                >
                    <Icon
                        className={`size-5 ${style?.iconClass ?? 'text-primary'}`}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">{stop.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {stop.code ? `Stop ${stop.code}` : 'Stop'}
                        {stop.distanceM != null
                            ? ` · ${formatDistance(stop.distanceM)} away`
                            : ''}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                        favourited
                            ? 'Remove from favourites'
                            : 'Add to favourites'
                    }
                    aria-pressed={favourited}
                    onClick={toggleFavourite}
                    className="shrink-0 rounded-full"
                >
                    <Star
                        className={
                            favourited
                                ? 'size-5 fill-accent text-accent'
                                : 'size-5 text-zinc-400'
                        }
                    />
                </Button>
            </div>

            {arrivals.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    Live arrivals
                </div>
            )}

            {error ? (
                <div className={statusWrapClass}>
                    <p className="text-center text-sm text-alert">
                        Unable to load arrivals. Pull to retry.
                    </p>
                </div>
            ) : loading && arrivals.length === 0 ? (
                <div className={statusWrapClass}>
                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Loading arrivals…
                    </p>
                </div>
            ) : arrivals.length === 0 ? (
                <div className={statusWrapClass}>
                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No upcoming arrivals right now.
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {arrivals.map((arrival, i) => (
                        <div
                            key={`${arrival.tripId}-${arrival.stopSequence ?? i}`}
                            data-sheet-row
                            className={`flex items-center gap-3 rounded-xl p-3`}
                        >
                            <span
                                className="flex h-8 min-w-11 items-center justify-center rounded-md px-2 text-xs font-bold text-white"
                                style={{
                                    backgroundColor:
                                        arrival.color ?? 'var(--primary)',
                                }}
                            >
                                {arrival.route}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {arrival.destination}
                            </p>
                            <div className="flex flex-col items-end">
                                <span className={`text-base font-bold`}>
                                    {formatArrival(arrival.minutes)}
                                </span>
                                {arrival.live ? (
                                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                        <span className="relative flex size-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                                        </span>
                                        Live
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                                        Scheduled
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
