import type { Favourite, PickedLocation } from '@/types/place'

// Google gives no id for a picked place, so the coords are its id.
export const toPlaceFavourite = (
    place: NonNullable<PickedLocation>
): Favourite => ({
    placeType: 'place',
    placeId: `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`,
    label: place.label,
    lat: place.lat,
    lng: place.lng,
})
