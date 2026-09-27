import { Stop } from '@/types/common'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STOP_MODE_STYLE } from '@/types/common'

const StopRow = ({ stop, onSelect }: { stop: Stop; onSelect: () => void }) => {
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
                />
            ))}
        </div>
    )
}
