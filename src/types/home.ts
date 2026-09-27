export type MergedRow = {
    tripId: string
    routeId: string | null
    stopSequence: number | null
    arrivalEpoch: number
    live: boolean
}
