'use client'

import { useState } from 'react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TripTime } from '@/types/route'

// Native inputs want local 'YYYY-MM-DD' / 'HH:mm', not ISO/UTC.
const toLocal = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()

const INPUT_CLASS =
    'h-12 w-full rounded-xl bg-zinc-100 px-3 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent dark:bg-zinc-800'

export function TripTimeSheet({
    open,
    onOpenChange,
    value,
    onChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    value: TripTime
    onChange: (value: TripTime) => void
}) {
    // Draft only commits on Done, so dismissing the sheet discards edits.
    const [mode, setMode] = useState<'depart' | 'arrive'>('depart')
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [openedAt, setOpenedAt] = useState(0)

    // Re-seed the draft from the committed value each time the sheet opens.
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) {
            const now = new Date()
            setOpenedAt(now.getTime())
            // Default to the next 5-min slot so a fresh draft is already valid.
            const next = new Date(
                Math.ceil((now.getTime() + 1) / 300000) * 300000
            )
            const local = toLocal(value?.at ?? next)
            setMode(value?.mode ?? 'depart')
            setDate(local.slice(0, 10))
            setTime(local.slice(11, 16))
        }
    }

    const picked = new Date(`${date}T${time}`)
    const valid = !isNaN(picked.getTime()) && picked.getTime() > openedAt

    const finish = (next: TripTime) => {
        onChange(next)
        onOpenChange(false)
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="z-[70] mx-auto h-auto max-w-md">
                <div className="space-y-5 px-5 pt-4 pb-8">
                    <DrawerTitle className="text-lg">When?</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        Choose to depart or arrive at a day and time
                    </DrawerDescription>

                    <Tabs
                        value={mode}
                        onValueChange={(v) => setMode(v as typeof mode)}
                    >
                        <TabsList className="w-full">
                            <TabsTrigger value="depart">Depart at</TabsTrigger>
                            <TabsTrigger value="arrive">Arrive by</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="grid grid-cols-[3fr_2fr] gap-2">
                        <input
                            type="date"
                            aria-label="Date"
                            min={
                                date && toLocal(new Date(openedAt)).slice(0, 10)
                            }
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={INPUT_CLASS}
                        />
                        <input
                            type="time"
                            aria-label="Time"
                            step={300}
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className={INPUT_CLASS}
                        />
                    </div>
                    {!valid && date && time && (
                        <p className="-mt-3 text-xs text-alert">
                            Pick a time in the future.
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => finish(null)}
                            className="rounded-xl bg-zinc-100 dark:bg-zinc-800"
                        >
                            Leave now
                        </Button>
                        <Button
                            disabled={!valid}
                            onClick={() => finish({ mode, at: picked })}
                            className="rounded-xl"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
