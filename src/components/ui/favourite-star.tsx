'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Favourite star with a short press/fill motion. */
export function FavouriteStar({
    favourited,
    className,
}: {
    favourited: boolean
    className?: string
}) {
    return (
        <Star
            className={cn(
                'size-4 transition-[transform,colors,fill] duration-200 ease-out',
                favourited
                    ? 'fill-accent text-accent scale-110'
                    : 'text-zinc-400 scale-100',
                className
            )}
        />
    )
}

export function FavouriteStarButton({
    favourited,
    label,
    onClick,
    className,
}: {
    favourited: boolean
    label: string
    onClick: () => void
    className?: string
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={favourited}
            onClick={onClick}
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 active:scale-90 dark:hover:bg-zinc-800',
                className
            )}
        >
            <FavouriteStar favourited={favourited} />
        </button>
    )
}
