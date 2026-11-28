import { useEffect, useState } from 'react'
import type { BusLeg } from '@/types/journey'
import { STOP_MODE_STYLE } from '@/util/stopMode'

// Bus / tram / train glyph for a ride leg, matching the stop icons on the map.
export const ModeIcon = ({
    leg,
    ...props
}: { leg: BusLeg } & React.ComponentProps<'svg'>) => {
    const Icon = STOP_MODE_STYLE[leg.mode].icon
    return <Icon {...props} />
}

export const LiveDot = () => (
    <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
    </span>
)

// "Updated 12s ago" over a live map, so it's clear the bus keeps moving.
// at: when the newest bus position was sent (epoch seconds).
export const UpdatedAgo = ({ at }: { at: number | null }) => {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])
    if (at == null) return null
    const s = Math.max(0, Math.round(now / 1000 - at))
    return (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold whitespace-nowrap tabular-nums shadow-lg dark:bg-zinc-800">
            <LiveDot />
            Updated {s < 60 ? `${s}s` : `${Math.floor(s / 60)} min`} ago
        </div>
    )
}
