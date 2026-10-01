import { Check, TriangleAlert, Zap } from 'lucide-react'
import { BusLeg } from '@/types/route'

// Can you make the bus? Compares the walk to the stop with the countdown.
export function catchHint(walkMin: number, departsIn: number) {
    const slack = departsIn - walkMin
    if (slack >= 2)
        return {
            Icon: Check,
            text: `${walkMin} min walk — you have time`,
            className:
                'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
        }
    if (slack >= 0)
        return {
            Icon: Zap,
            text: `Leave now — ${walkMin} min walk`,
            className:
                'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
        }
    return {
        Icon: TriangleAlert,
        text: `Tight — ${walkMin} min walk, bus in ${departsIn} min`,
        className: 'bg-alert/10 text-alert',
    }
}

// Delay only means something with realtime data; schedule-only rows say so instead.
export function delayStatus(leg: BusLeg) {
    if (!leg.live)
        return {
            label: 'Scheduled',
            className: 'text-zinc-500 dark:text-zinc-400',
        }
    // Live prediction but no timetable time to compare against: we know when
    // it's coming, not whether that's late, so don't claim "On time".
    if (leg.delayMin == null)
        return {
            label: 'Live',
            className: 'text-emerald-600 dark:text-emerald-400',
        }
    const delay = leg.delayMin
    if (delay > 0)
        return { label: `${delay} min late`, className: 'text-alert' }
    if (delay < 0)
        return {
            label: `${-delay} min early`,
            className: 'text-lime-600 dark:text-lime-400',
        }
    return {
        label: 'On time',
        className: 'text-sky-600 dark:text-sky-400',
    }
}
