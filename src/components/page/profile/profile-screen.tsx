'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SESSION_QUERY_KEY } from '@/hooks/useSession'
import type { AppSession } from '@/types/auth'

const ERROR_MSG: Record<string, string> = {
    oauth: 'Google sign-in was cancelled or failed.',
    state: 'Sign-in could not be verified. Try again.',
    token: 'Could not exchange the login code. Try again.',
    userinfo: 'Could not load your Google profile. Try again.',
}

export function ProfileScreen({
    session,
    oauthError,
}: {
    session: AppSession | null
    oauthError?: string
}) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [busy, setBusy] = useState(false)

    // Google OAuth leaves the page; Back restores it with busy still true.
    useEffect(() => {
        const reset = () => setBusy(false)
        window.addEventListener('pageshow', reset)
        return () => window.removeEventListener('pageshow', reset)
    }, [])

    const signOut = async () => {
        setBusy(true)
        await fetch('/api/auth/signout', { method: 'POST' })
        await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        await queryClient.invalidateQueries({ queryKey: ['favourites'] })
        router.refresh()
        setBusy(false)
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="shrink-0 bg-primary px-4 pt-4 pb-3">
                <h1 className="text-lg font-bold text-white">Profile</h1>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
                {session ? (
                    <>
                        <div className="flex items-center gap-3">
                            {session.picture ? (
                                <Image
                                    src={session.picture}
                                    alt=""
                                    width={56}
                                    height={56}
                                    className="rounded-full"
                                />
                            ) : (
                                <span className="flex size-14 items-center justify-center rounded-full bg-zinc-200">
                                    <User className="size-6 text-zinc-500" />
                                </span>
                            )}
                            <div className="min-w-0">
                                {session.name && (
                                    <p className="truncate font-semibold">
                                        {session.name}
                                    </p>
                                )}
                                <p className="truncate text-sm text-zinc-500">
                                    {session.email}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="justify-start gap-3 rounded-xl"
                            onClick={() => router.push('/favourite')}
                        >
                            <Star className="size-4 fill-accent text-accent" />
                            Your favourites
                        </Button>
                        <Button
                            variant="ghost"
                            className="rounded-xl border border-zinc-300"
                            disabled={busy}
                            onClick={signOut}
                        >
                            Sign out
                        </Button>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="font-semibold">Sign in</p>
                            <p className="text-sm text-zinc-500">
                                Keep your favourite places and stops on every
                                device.
                            </p>
                        </div>
                        <Button
                            className="rounded-xl"
                            disabled={busy}
                            onClick={() => {
                                setBusy(true)
                                window.location.href = '/api/auth/google'
                            }}
                        >
                            Continue with Google
                        </Button>
                    </>
                )}
                {oauthError && (
                    <p className="text-sm text-alert">
                        {ERROR_MSG[oauthError] ?? 'Sign-in failed.'}
                    </p>
                )}
            </div>
        </div>
    )
}
