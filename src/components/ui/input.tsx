import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            className={cn(
                'flex h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700',
                className
            )}
            {...props}
        />
    )
}

export { Input }
