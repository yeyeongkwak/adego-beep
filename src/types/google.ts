// Shapes of Google API responses. Every field is optional: don't trust them.

export type GoogleRoute = {
    duration?: string
    legs?: { steps?: TransitStep[] }[]
}

export type LatLngLiteral = { latitude: number; longitude: number }

export type GoogleStop = {
    name?: string
    location?: { latLng?: LatLngLiteral }
}

export type TransitStep = {
    travelMode?: string
    staticDuration?: string
    polyline?: { encodedPolyline?: string }
    transitDetails?: {
        stopDetails?: {
            arrivalStop?: GoogleStop
            departureStop?: GoogleStop
            arrivalTime?: string
            departureTime?: string
        }
        headsign?: string
        transitLine?: {
            name?: string
            nameShort?: string
            color?: string
            vehicle?: { type?: string }
        }
    }
}

export type PlacePrediction = {
    placePrediction?: {
        placeId?: string
        text?: { text?: string }
        structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
        }
    }
}
