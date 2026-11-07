import { BusLeg } from '@/types/route'
import { STOP_MODE_STYLE } from '@/types/common'

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
