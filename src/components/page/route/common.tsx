import { BusLeg } from '@/types/route'
import { STOP_MODE_STYLE } from '@/types/common'
import { cn } from '@/lib/utils'

// Bus / tram / train glyph for a ride leg, matching the stop icons on the map.
export const ModeIcon = ({
    leg,
    ...props
}: { leg: BusLeg } & React.ComponentProps<'svg'>) => {
    const Icon = STOP_MODE_STYLE[leg.mode].icon
    return <Icon {...props} />
}

// Bus icon on the left, your boarding stop highlighted on the right.
export const VehicleTrack = ({ leg }: { leg: BusLeg }) => {
    if (!leg.vehicle) {
        return (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Bus location unavailable — showing timetable.
            </p>
        )
    }
    const { stopsAway, nearStop } = leg.vehicle
    // stopsAway null = vehicle tracked but still on an earlier block trip;
    // show the live dot without a (misleading) stop count.
    const dots = stopsAway != null ? Math.min(stopsAway, 6) : 0
    return (
        <div className="space-y-2 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="flex items-center gap-2">
                <ModeIcon
                    leg={leg}
                    className="size-4 shrink-0"
                    style={{ color: leg.color ?? 'var(--primary)' }}
                />
                {Array.from({ length: dots }, (_, i) => (
                    <span key={i} className="flex flex-1 items-center">
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                i === dots - 1
                                    ? 'size-3 border-2 border-primary bg-white dark:border-accent'
                                    : 'bg-zinc-300 dark:bg-zinc-600'
                            )}
                        />
                    </span>
                ))}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <LiveDot />
                <span className="font-semibold">
                    {stopsAway != null
                        ? `${stopsAway} ${stopsAway === 1 ? 'stop' : 'stops'} away`
                        : 'Live tracking'}
                </span>{' '}
                · near {nearStop}
            </p>
        </div>
    )
}

export const LiveDot = () => (
    <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
    </span>
)
