import { BusFront, TrainFront, TramFront } from 'lucide-react'
import type { StopMode } from '@/types/place'

export const STOP_MODE_STYLE: Record<
    StopMode,
    { icon: typeof BusFront; iconClass: string; bgClass: string }
> = {
    BUS: {
        icon: BusFront,
        iconClass: 'text-primary',
        bgClass: 'bg-primary/10',
    },
    TRAM: {
        icon: TramFront,
        iconClass: 'text-accent',
        bgClass: 'bg-accent/10',
    },
    RAIL: { icon: TrainFront, iconClass: 'text-alert', bgClass: 'bg-alert/10' },
}
