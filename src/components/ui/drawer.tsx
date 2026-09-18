'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { cn } from '@/lib/utils'

function Drawer({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
    return <DrawerPrimitive.Root {...props} />
}

function DrawerPortal({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
    return <DrawerPrimitive.Portal {...props} />
}

function DrawerOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay
            className={cn('fixed inset-0 z-50 bg-black/40', className)}
            {...props}
        />
    )
}

function DrawerContent({
    className,
    children,
    showHandle = true,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
    showHandle?: boolean
}) {
    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                className={cn(
                    'fixed inset-x-0 bottom-0 z-50 flex h-full max-h-[97%] flex-col rounded-t-3xl border-t border-zinc-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] outline-none dark:border-zinc-800 dark:bg-zinc-900',
                    className
                )}
                {...props}
            >
                {showHandle && (
                    <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                )}
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    )
}

function DrawerTitle({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
    return (
        <DrawerPrimitive.Title
            className={cn('font-semibold', className)}
            {...props}
        />
    )
}

function DrawerDescription({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            className={cn('text-sm text-zinc-500', className)}
            {...props}
        />
    )
}

export {
    Drawer,
    DrawerPortal,
    DrawerOverlay,
    DrawerContent,
    DrawerTitle,
    DrawerDescription,
}
