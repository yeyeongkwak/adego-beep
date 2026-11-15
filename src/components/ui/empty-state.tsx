import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode
    title: string
    description?: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center px-6 py-14 text-center',
                className
            )}
        >
            {icon && (
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/8 text-primary">
                    {icon}
                </div>
            )}
            <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {title}
            </p>
            {description && (
                <p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {description}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    )
}
