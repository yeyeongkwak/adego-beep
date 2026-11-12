import type { Metadata } from 'next'
import { FavouriteScreen } from '@/components/page/favourite/favourite-screen'

export const metadata: Metadata = { title: 'Favourites' }

export default function FavouritePage() {
    return <FavouriteScreen />
}
