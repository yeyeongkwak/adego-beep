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
        // Don't pad with safe-area here: on iOS standalone, fixed bottom bars
        // are already inset, so env(safe-area-inset-bottom) doubles the gap.
        <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex h-16 w-full max-w-md items-center justify-between border-t border-zinc-200 bg-white px-2 supports-[display-mode:standalone]:max-w-none dark:border-zinc-700 dark:bg-zinc-950">
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
    )
}
