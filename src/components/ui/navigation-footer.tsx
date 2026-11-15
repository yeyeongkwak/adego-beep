'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Route, Star, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAVIGATION_ITEMS = [
    {
        id: 'home',
        label: 'Home',
        href: '/home',
        icon: Home,
    },
    {
        id: 'route',
        label: 'Route',
        href: '/route',
        icon: Route,
    },
    {
        id: 'favourite',
        label: 'Favourite',
        href: '/favourite',
        icon: Star,
    },
    {
        id: 'profile',
        label: 'Profile',
        href: '/profile',
        icon: User,
    },
]

export function NavigationFooter() {
    const pathname = usePathname()
    const router = useRouter()

    return (
        // Content row is h-14; safe-area only extends the white bg under the
        // home indicator so labels aren't buried in the corners.
        <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-md border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom,0px)] supports-[display-mode:standalone]:max-w-none dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex h-14 items-center justify-between px-2">
                {NAVIGATION_ITEMS.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(item.href)}
                            className={cn(
                                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95',
                                isActive
                                    ? 'text-primary'
                                    : 'text-zinc-500 dark:text-zinc-400'
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-9 items-center justify-center rounded-xl transition-colors duration-150',
                                    isActive && 'bg-primary/10'
                                )}
                            >
                                <Icon
                                    className="size-[22px]"
                                    strokeWidth={isActive ? 2.4 : 2}
                                    fill={
                                        isActive && item.id === 'favourite'
                                            ? 'currentColor'
                                            : 'none'
                                    }
                                />
                            </span>
                            <span
                                className={cn(
                                    'text-[11px] tracking-tight',
                                    isActive ? 'font-bold' : 'font-semibold'
                                )}
                            >
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
