import {
    Briefcase,
    Dumbbell,
    GraduationCap,
    Heart,
    House,
    ShoppingBag,
    type LucideIcon,
} from 'lucide-react'
import type { FavouriteIcon } from '@/types/place'

export const FAVOURITE_ICONS: Record<
    FavouriteIcon,
    { Icon: LucideIcon; label: string }
> = {
    home: { Icon: House, label: 'Home' },
    school: { Icon: GraduationCap, label: 'School' },
    work: { Icon: Briefcase, label: 'Work' },
    gym: { Icon: Dumbbell, label: 'Gym' },
    shop: { Icon: ShoppingBag, label: 'Shopping' },
    heart: { Icon: Heart, label: 'Favourite' },
}

export const isFavouriteIcon = (v: unknown): v is FavouriteIcon =>
    typeof v === 'string' && v in FAVOURITE_ICONS
