// Shapes of OpenTripPlanner GTFS GraphQL responses (planConnection). Every
// field is optional: don't trust them.

export type OtpPlace = {
    name?: string
    lat?: number
    lon?: number
    stop?: { code?: string | null } | null
}

export type OtpTime = {
    scheduledTime?: string
    estimated?: { time?: string } | null
}

export type OtpLeg = {
    mode?: string
    duration?: number // seconds
    realTime?: boolean
    headsign?: string | null
    start?: OtpTime
    end?: OtpTime
    from?: OtpPlace
    to?: OtpPlace
    route?: {
        shortName?: string | null
        longName?: string | null
        color?: string | null // hex without '#'
    } | null
    trip?: { gtfsId?: string } | null
    legGeometry?: { points?: string } | null
}

export type OtpItinerary = {
    duration?: number // seconds
    legs?: OtpLeg[]
}
