import type { SupabaseClient } from '@supabase/supabase-js'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import type { ServiceAlert } from '@/types/arrival'
import type { LatLng } from '@/types/geo'
import { distanceMeters } from '@/util/map/distance'

// Adelaide Metro notices (the "service disruptions" on their site). Every
// alert has cause/effect UNKNOWN and points at routes only, never stops. The
// stops are only in the text ("Stop 4A and Stop 5 South Rd"), so we read them
// from there: which are closed (hide notices that close none of the ride's
// stops) and where to go instead.

const FEED_URL = 'https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts'
const FEED_TTL_MS = 5 * 60_000
const MAX_TEXT = 1200

type Period = { start: number; end: number }

type TimedAlert = ServiceAlert & {
    // 0 or missing end = "until further notice".
    periods: Period[]
    routeIds: string[]
    // stopKey()s the text closes or moves. Empty = we can't tell, so always
    // show.
    closedKeys: string[]
    // Closed stopKey → where to go instead. One notice can cover routes
    // with their own pairs (98A: V1 → I1, 98C: F1 → R1).
    alternativesFor: Record<string, Alternative[]>
    // Hours of the day it applies (Adelaide minutes from midnight), when the
    // text says so. The feed's period only has the first and last day.
    daily: { from: number; to: number } | null
}

const CODE = String.raw`[A-Z]?\d{1,3}[A-Z]?`
// "Stop 9, 8, 7 & 6 South Rd", "Stops 32A, 32B and 33 Lyons Rd".
const STOP_MENTION = new RegExp(
    String.raw`\bStops?\s+(${CODE}(?:\s*(?:,|&|and|or)\s*(?:Stop\s+)?${CODE})*)\s+([A-Z][\w']*)`,
    'g'
)

// Stop number + first word of the street, e.g. "f1|hutt". Numbers repeat
// across roads, and the text writes streets loosely ("Street", "OConnell").
const key = (code: string, street: string) =>
    `${code.toLowerCase()}|${street.toLowerCase().replace(/'/g, '')}`

// For a GTFS stop name like "Stop F1 Hutt St - East side".
export function stopKey(name: string): string | null {
    const m = name.match(new RegExp(String.raw`^Stop\s+(${CODE})\s+([\w']+)`))
    return m ? key(m[1], m[2]) : null
}

const ADVICE = /\b(?:advised|alternat\w*|go to|use|instead)\b/i
// "Stop 41A Kesters Rd - North East side, go to Stop 41 ...". No digits, so
// "...side 450 to Riverlea Park, go to" (a route number) doesn't count.
const CLOSED_AFTER = /^[^.\d]{0,40}?(?:,\s*go to\b|\bwill\b|\bclosed\b)/i

const keysIn = (m: RegExpMatchArray) =>
    (m[1].match(new RegExp(CODE, 'g')) ?? []).map((c) => key(c, m[2]))

// "Stop 5 O'Connell St - West side" → "west side". Null for "both sides".
const SIDE_AFTER =
    /^[^.\d,]{0,30}?\b((?:north|south)(?:\s+(?:east|west))?|east|west)\s+side\b/i
const sideAfter = (text: string) =>
    text.match(SIDE_AFTER)?.[1].toLowerCase().replace(/\s+/g, ' ') ?? null

// Where to go instead. `routes` when the text says it's only for some routes
// ("98A - Stop 6 Buxton St - South side ... 98C - Stop 6 Buxton St - North
// side"), `side` when it names one.
type Alternative = { key: string; side: string | null; routes: string[] | null }

type Named = {
    closed: Set<string>
    // Table rows: these closed stops → these alternatives.
    pairs: { closed: string[]; alternatives: Alternative[] }[]
    // From sentences: for any closed stop in the notice.
    anyAlternative: Alternative[]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Groups of this notice's routes in the text: "98C, 99C", "98C – 99C",
// "170, 171 & 822". Route numbers inside a stop name don't count.
function routeGroups(text: string, routeIds: string[]) {
    if (routeIds.length === 0) return []
    const one = `(?:${routeIds
        .toSorted((a, b) => b.length - a.length)
        .map(escape)
        .join('|')})`
    const group = new RegExp(
        String.raw`(?<![\w/])${one}(?:\s*(?:,|&|and|–|-)\s*${one})*(?![\w/])`,
        'g'
    )
    const stops = [...text.matchAll(STOP_MENTION)].map((m) => [
        m.index,
        m.index + m[0].length,
    ])
    return [...text.matchAll(group)]
        .filter((m) => !stops.some(([a, b]) => m.index >= a && m.index < b))
        .map((m) => ({
            at: m.index,
            routes: m[0].match(new RegExp(one, 'g')) ?? [],
        }))
}

const alternativesIn = (text: string, routes: string[] | null) =>
    [...text.matchAll(STOP_MENTION)].flatMap((m) => {
        const side = sideAfter(text.slice(m.index + m[0].length))
        return keysIn(m).map((k) => ({ key: k, side, routes }))
    })

// Tables have a "Closed stop" and an "Alternative stop" column, one pair per
// row. One alternative cell often spans many rows (rowspan), so go by column.
// A heading just above ("98A – 99A - Anticlockwise") says which routes.
function readTables(html: string, routeIds: string[], out: Named) {
    let prevEnd = 0
    for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
        const table = m[0]
        const heading = routeGroups(
            htmlToText(html.slice(prevEnd, m.index)),
            routeIds
        ).at(-1)
        prevEnd = m.index + table.length
        const routes = heading?.routes ?? null
        let closedCol = -1
        let altCol = -1
        // A rowspan cell's text and how many more rows it covers, per column.
        let covered: { rows: number; text: string }[] = []
        for (const [row] of table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
            const cells: { col: number; text: string }[] = []
            let col = 0
            const take = () => {
                while (covered[col]?.rows > 0) {
                    cells.push({ col, text: covered[col].text })
                    col++
                }
            }
            for (const [, attrs, inner] of row.matchAll(
                /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi
            )) {
                take()
                const text = htmlToText(inner)
                cells.push({ col, text })
                const span = +(attrs.match(/rowspan="?(\d+)/i)?.[1] ?? 1)
                if (span > 1) covered[col] = { rows: span, text }
                col++
            }
            take()
            covered = covered.map((c) => c && { ...c, rows: c.rows - 1 })
            const head = (re: RegExp) =>
                cells.find((c) => re.test(c.text) && !/\d/.test(c.text))?.col
            const c = head(/closed|not serviced|missed/i)
            const a = head(/alternat/i)
            if (c != null && a != null) {
                closedCol = c
                altCol = a
                continue
            }
            const textAt = (n: number) =>
                cells.find((cell) => cell.col === n)?.text ?? ''
            const closed = [
                ...textAt(closedCol).matchAll(STOP_MENTION),
            ].flatMap(keysIn)
            if (closedCol < 0 || closed.length === 0) continue
            closed.forEach((k) => out.closed.add(k))
            out.pairs.push({
                closed,
                alternatives: alternativesIn(textAt(altCol), routes),
            })
        }
    }
}

// Sentences: stops before "advised to use / go to / alternative" are closed,
// stops after it are where to go ("Stop 7 Tynte St will not be serviced.
// Passengers are advised to go to Stop 6 Buxton St"). Routes named earlier in
// the same sentence ("Routes - 98C, 99C go to ...") limit an alternative.
function readSentences(text: string, routeIds: string[], out: Named) {
    const found = [...text.matchAll(STOP_MENTION)]
    const groups = routeGroups(text, routeIds)
    found.forEach((m, i) => {
        const at = m.index
        const end = at + m[0].length
        // A paragraph ends ".\n", not ". ".
        const sentenceAt =
            ([...text.slice(0, at).matchAll(/\.\s/g)].at(-1)?.index ?? -1) + 1
        const sentence = text.slice(sentenceAt, at)
        const after = text.slice(end, found[i + 1]?.index ?? text.length)
        if (!ADVICE.test(sentence) || CLOSED_AFTER.test(after)) {
            keysIn(m).forEach((k) => out.closed.add(k))
            return
        }
        const scope = groups.findLast((g) => g.at >= sentenceAt && g.at < at)
        // "Passengers for the 281 ... use Stop B2. All other passengers ...
        // use Stop B1": B1 is for the routes not named before.
        const named = new Set(
            groups.filter((g) => g.at < sentenceAt).flatMap((g) => g.routes)
        )
        const routes =
            scope?.routes ??
            (/\ball other\b/i.test(sentence)
                ? routeIds.filter((r) => !named.has(r))
                : null)
        const side = sideAfter(text.slice(end))
        keysIn(m).forEach((k) =>
            out.anyAlternative.push({ key: k, side, routes })
        )
    })
}

function namedStops(title: string, html: string, routeIds: string[]) {
    const out: Named = { closed: new Set(), pairs: [], anyAlternative: [] }
    readTables(html, routeIds, out)
    readSentences(
        `${title}.\n${htmlToText(html.replace(/<table\b[\s\S]*?<\/table>/gi, '\n'))}`,
        routeIds,
        out
    )
    const alternativesFor: Record<string, Alternative[]> = {}
    for (const k of out.closed) {
        const paired = out.pairs
            .filter((p) => p.closed.includes(k))
            .flatMap((p) => p.alternatives)
        // "T buses use Stop 6 and 8 until Stop 7 reopens": closed wins.
        alternativesFor[k] = [...paired, ...out.anyAlternative].filter(
            (a) => !out.closed.has(a.key)
        )
    }
    return { closedKeys: [...out.closed], alternativesFor }
}

const ENTITIES: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    ndash: '–',
    mdash: '—',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    hellip: '…',
}

// The description is HTML. Keep line breaks, drop tags.
function htmlToText(html: string): string {
    return html
        .replace(/<\s*(br|\/p|\/li|\/tr|\/h\d)\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code: string) => {
            if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? m
            const n =
                code[1] === 'x' || code[1] === 'X'
                    ? parseInt(code.slice(2), 16)
                    : parseInt(code.slice(1), 10)
            return Number.isFinite(n) ? String.fromCodePoint(n) : m
        })
        .replace(/[ \t ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// The feed splits one period in two: {start, no end} and {no start, end}.
// Read alone, the second looks "on since forever", so a December pageant
// showed today. Join the halves back into one period.
function mergePeriods(periods: Period[]): Period[] {
    const whole = periods.filter((p) => p.start && p.end)
    const starts = periods.filter((p) => p.start && !p.end).map((p) => p.start)
    const ends = periods.filter((p) => !p.start && p.end).map((p) => p.end)
    if (starts.length || ends.length)
        whole.push({
            start: starts.length ? Math.max(...starts) : 0,
            end: ends.length ? Math.min(...ends) : 0,
        })
    return whole
}

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)`
// "Between 8:00pm and last bus service", "From 7:00pm to 4:00am, each night",
// "From 7:00am until 6:00pm each day". A span like "From 6am Friday 20
// November to 6am Tuesday" doesn't match: a day follows the first time.
const DAILY = new RegExp(
    String.raw`\b(?:between|from)\s+(?:approx\.?\s*)?${TIME}\s+(?:and|to|until)\s+(?:${TIME}|last (?:bus )?service)`,
    'i'
)
// "Last service" has no time. Buses stop around then.
const LAST_SERVICE_MIN = 4 * 60

const toMinutes = (h: string, m: string | undefined, ampm: string) =>
    ((+h % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0)) * 60 + +(m ?? 0)

function dailyWindow(body: string): TimedAlert['daily'] {
    const m = body.match(DAILY)
    if (!m) return null
    return {
        from: toMinutes(m[1], m[2], m[3]),
        to: m[4] ? toMinutes(m[4], m[5], m[6]) : LAST_SERVICE_MIN,
    }
}

const adelaideClock = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Adelaide',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
})

function inWindow(w: NonNullable<TimedAlert['daily']>, epoch: number) {
    const parts = adelaideClock.formatToParts(new Date(epoch * 1000))
    const part = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0)
    const now = part('hour') * 60 + part('minute')
    // 7pm to 4am runs past midnight.
    return w.from <= w.to
        ? w.from <= now && now < w.to
        : now >= w.from || now < w.to
}

const text = (t?: { translation?: { text?: string | null }[] | null } | null) =>
    t?.translation?.[0]?.text ?? ''

const toNumber = (v: unknown) => (v == null ? 0 : Number(v))

let cached: { fetchedAt: number; alerts: TimedAlert[] } | null = null
let inFlight: Promise<TimedAlert[]> | null = null

async function loadAlerts(): Promise<TimedAlert[]> {
    const res = await fetch(FEED_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Service alerts feed responded ${res.status}`)
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(await res.arrayBuffer())
    )
    const alerts: TimedAlert[] = []
    for (const entity of feed.entity) {
        const alert = entity.alert
        if (!alert) continue
        const routeIds = (alert.informedEntity ?? [])
            .map((e) => e.routeId)
            .filter((r): r is string => !!r)
        if (routeIds.length === 0) continue
        const title = text(alert.headerText).trim()
        let body = htmlToText(text(alert.descriptionText))
        const named = namedStops(title, text(alert.descriptionText), routeIds)
        const daily = dailyWindow(body)
        if (body.length > MAX_TEXT) body = `${body.slice(0, MAX_TEXT)}…`
        alerts.push({
            id: entity.id,
            title,
            text: body,
            url: text(alert.url) || null,
            periods: mergePeriods(
                (alert.activePeriod ?? []).map((p) => ({
                    start: toNumber(p.start),
                    end: toNumber(p.end),
                }))
            ),
            routeIds,
            ...named,
            daily,
        })
    }
    // Newest first: a fresh detour matters more than a stop moved last year.
    const start = (a: TimedAlert) =>
        Math.max(0, ...a.periods.map((p) => p.start))
    return alerts.sort((a, b) => start(b) - start(a))
}

async function getAlerts(): Promise<TimedAlert[]> {
    if (cached && Date.now() - cached.fetchedAt < FEED_TTL_MS)
        return cached.alerts
    if (inFlight) return inFlight
    inFlight = loadAlerts()
        .then((alerts) => {
            cached = { fetchedAt: Date.now(), alerts }
            return alerts
        })
        .catch((error) => {
            if (cached) return cached.alerts
            throw error
        })
        .finally(() => {
            inFlight = null
        })
    return inFlight
}

const DETOUR = /\bdetour/i

const activeAt = (a: TimedAlert, epoch: number) =>
    (a.periods.length === 0 ||
        a.periods.some((p) => p.start <= epoch && (!p.end || epoch < p.end))) &&
    (!a.daily || inWindow(a.daily, epoch))

type NamedStop = LatLng & { name: string }

// An alternative further than this from the closed stop is for another
// route or direction in the same notice.
const ALTERNATIVE_MAX_M = 1500

const stopsByKey = new Map<string, Promise<NamedStop[]>>()

// GTFS stops for a stopKey, e.g. "6|buxton" → both sides of Stop 6 Buxton St.
function findStops(db: SupabaseClient, k: string): Promise<NamedStop[]> {
    if (!stopsByKey.has(k)) {
        const code = k.split('|')[0].toUpperCase()
        const found = Promise.resolve(
            db
                .from('gtfs_stops')
                .select('stop_name, stop_lat, stop_lon')
                .ilike('stop_name', `Stop ${code} %`)
                .then(({ data, error }) => {
                    if (error) throw error
                    return (data ?? [])
                        .filter((s) => stopKey(s.stop_name ?? '') === k)
                        .map((s) => ({
                            name: s.stop_name as string,
                            lat: s.stop_lat as number,
                            lng: s.stop_lon as number,
                        }))
                })
        )
        // Don't keep a failure; try again next time.
        found.then(undefined, () => stopsByKey.delete(k))
        stopsByKey.set(k, found)
    }
    return stopsByKey.get(k)!
}

// "Stop 4 O'Connell St - West side" → "west", same form as sideAfter().
const sideOf = (name: string) =>
    name
        .split(' - ')[1]
        ?.toLowerCase()
        .replace(/\s*sides?$/, '')
        .replace(/\s+/g, ' ')
        .trim() ?? ''

// For each alternative, its stop on the side the text names, else on the
// same side as a closed one (the other side of the road goes the other way),
// else the nearest, if close.
async function locateAlternatives(
    db: SupabaseClient,
    alternatives: Alternative[],
    closed: NamedStop[]
): Promise<NamedStop[]> {
    const found = await Promise.all(
        alternatives.map((a) => findStops(db, a.key).catch(() => []))
    )
    const near = (s: NamedStop) =>
        Math.min(...closed.map((c) => distanceMeters(c, s)))
    const located = found.flatMap((stops, i) => {
        const want = alternatives[i].side
        const sides = want ? [want] : closed.map((c) => sideOf(c.name))
        const rank = (s: NamedStop) =>
            (sides.includes(sideOf(s.name)) ? 0 : ALTERNATIVE_MAX_M) + near(s)
        const best = stops.toSorted((a, b) => rank(a) - rank(b))[0]
        return best && near(best) <= ALTERNATIVE_MAX_M ? [best] : []
    })
    return [...new Map(located.map((s) => [s.name, s])).values()]
}

// Returns a lookup: alerts for a route (GTFS route_id = short name, e.g.
// "98C") that are on at the given time. With the ride's stops, a notice that
// closes stops only shows if it closes one on the ride; `stops` says which and
// `alternatives` where to go instead of a closed boarding or get-off stop.
// Empty if the feed is down.
export async function getRouteAlerts(
    db: SupabaseClient
): Promise<
    (
        routeId: string,
        epoch: number,
        rideStops?: NamedStop[]
    ) => Promise<ServiceAlert[]>
> {
    const alerts = await getAlerts().catch((error: Error) => {
        console.warn(`[alerts] feed failed: ${error.message}`)
        return [] as TimedAlert[]
    })
    return async (routeId, epoch, rideStops) => {
        const on = alerts.filter(
            (a) => a.routeIds.includes(routeId) && activeAt(a, epoch)
        )
        const out = await Promise.all(
            on.map(async (a): Promise<ServiceAlert | null> => {
                const { id, title, text, url } = a
                const base = {
                    id,
                    title,
                    text,
                    url,
                    detour: DETOUR.test(title) || undefined,
                }
                if (!rideStops?.length || a.closedKeys.length === 0) return base
                const closed = rideStops.filter((s) => {
                    const k = stopKey(s.name)
                    return k != null && a.closedKeys.includes(k)
                })
                if (closed.length === 0) return null
                // Where to go instead only matters where you board or get
                // off. A closed stop the bus just passes changes nothing for
                // you, and its alternative can be far back up the route.
                const ends = [rideStops[0], rideStops.at(-1)!]
                const closedEnds = closed.filter((s) => ends.includes(s))
                const alternatives = await locateAlternatives(
                    db,
                    closedEnds
                        .flatMap((s) => a.alternativesFor[stopKey(s.name)!])
                        .filter(
                            (alt) => !alt.routes || alt.routes.includes(routeId)
                        ),
                    closedEnds
                )
                return {
                    ...base,
                    stops: [...new Set(closed.map((s) => s.name))],
                    ...(alternatives.length && { alternatives }),
                }
            })
        )
        return out.filter((a): a is ServiceAlert => a != null)
    }
}

// Routes with a detour on now. Throws if the feed is down.
export async function getDetourRoutes(epoch: number): Promise<Set<string>> {
    const alerts = await getAlerts()
    return new Set(
        alerts
            .filter((a) => DETOUR.test(a.title) && activeAt(a, epoch))
            .flatMap((a) => a.routeIds)
    )
}
