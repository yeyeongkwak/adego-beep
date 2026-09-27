'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Map, Heart, User } from 'lucide-react'
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
        icon: Map,
    },
    {
        id: 'favourite',
        label: 'Favourite',
        href: '/favourite',
        icon: Heart,
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
        <div className="fixed bottom-0 left-1/2 z-[60] flex -translate-x-1/2 w-full max-w-md h-16 items-center justify-around border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
            {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)

                return (
                    <button
                        key={item.id}
                        onClick={() => router.push(item.href)}
                        className={cn(
                            'flex flex-col items-center justify-center gap-1 py-2 px-4 transition-colors',
                            isActive
                                ? 'text-primary'
                                : 'text-zinc-600 dark:text-zinc-400'
                        )}
                    >
                        <Icon className="size-6" />
                        <span className="text-xs font-medium">
                            {item.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
