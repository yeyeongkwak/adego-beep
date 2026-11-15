import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Shared sheet/list row — same rhythm on home, favourites, search. */
export function ListRow({
    icon,
    iconClass,
    title,
    subtitle,
    onClick,
    trailing,
    className,
}: {
    icon: ReactNode
    iconClass?: string
    title: string
    subtitle?: ReactNode
    onClick?: () => void
    trailing?: ReactNode
    className?: string
}) {
    return (
        <li className={cn('flex items-center gap-1', className)} data-sheet-row>
            <button
                type="button"
                onClick={onClick}
                disabled={!onClick}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-zinc-100 active:bg-zinc-100/80 disabled:hover:bg-transparent dark:hover:bg-zinc-800"
            >
                <span
                    className={cn(
                        'shrink-0 rounded-full p-2',
                        iconClass ?? 'bg-zinc-100 dark:bg-zinc-800'
                    )}
                >
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {title}
                    </span>
                    {subtitle != null && (
                        <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {subtitle}
                        </span>
                    )}
                </span>
            </button>
            {trailing}
        </li>
    )
}
