import { Check, TriangleAlert, Zap } from 'lucide-react'
import { BusLeg, Journey, LatLng } from '@/types/route'

// City Connector loops. Free for everyone.
const FREE_BUSES = new Set(['98A', '98C', '99A', '99C'])

// Trams are free from South Terrace north, and on Jetty Rd
// (Brighton Rd to Moseley Sq). Between the two you pay.
function freeTramZone({ lat, lng }: LatLng) {
    if (lat > -34.939) return 'city'
    if (lat < -34.975 && lng < 138.523) return 'glenelg'
    return null
}

const FREE_NOTE = { free: true, text: 'Free — no need to tap on' }

// What to tell the rider about paying. null = a normal ride, tap on as usual.
export function fareNote(leg: BusLeg): { free: boolean; text: string } | null {
    if (leg.mode === 'BUS') return FREE_BUSES.has(leg.route) ? FREE_NOTE : null
    if (leg.mode !== 'TRAM') return null
    const from = leg.path[0]
    const to = leg.path.at(-1)
    if (!from || !to) return null
    const zone = freeTramZone(from)
    if (!zone) return null
    if (zone === freeTramZone(to)) return FREE_NOTE
    return {
        free: false,
        text:
            zone === 'city'
                ? 'Free in the city. Tap on before you pass South Terrace'
                : 'Free on Jetty Rd. Tap on before you pass Brighton Rd',
    }
}

export const isFreeRide = (leg: BusLeg) => fareNote(leg)?.free ?? false

export function isFreeJourney(journey: Journey) {
    const rides = journey.legs.filter((leg) => leg.type === 'bus')
    return rides.length > 0 && rides.every(isFreeRide)
}

// Can you make the bus? Compare the walk time with the countdown.
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

// Only live data has a delay.
export function delayStatus(leg: Pick<BusLeg, 'live' | 'delayMin'>) {
    if (!leg.live)
        return {
            label: 'Scheduled',
            className: 'text-zinc-500 dark:text-zinc-400',
        }
    // Live, but no timetable time to compare. Don't say "On time".
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
