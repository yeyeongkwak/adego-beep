'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SESSION_QUERY_KEY } from '@/hooks/useSession'
import type { AppSession } from '@/types/auth'

const ERROR_MSG: Record<string, string> = {
    oauth: 'Google sign-in was cancelled or failed.',
    state: 'Sign-in could not be verified. Try again.',
    token: 'Could not exchange the login code. Try again.',
    userinfo: 'Could not load your Google profile. Try again.',
    insert: 'Could not create your account. Try again.',
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
        <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
            <PageHeader
                title="Profile"
                subtitle={
                    session
                        ? 'Your account on this device'
                        : 'Sign in to keep favourites everywhere'
                }
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
                {session ? (
                    <div className="fade-rise flex flex-col gap-5">
                        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
                            {session.picture ? (
                                <Image
                                    src={session.picture}
                                    alt=""
                                    width={56}
                                    height={56}
                                    className="rounded-full"
                                />
                            ) : (
                                <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                                    <User className="size-6 text-primary" />
                                </span>
                            )}
                            <div className="min-w-0">
                                {session.name && (
                                    <p className="truncate text-sm font-semibold tracking-tight">
                                        {session.name}
                                    </p>
                                )}
                                <p className="truncate text-xs text-zinc-500">
                                    {session.email}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="justify-start gap-3 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800"
                            onClick={() => router.push('/favourite')}
                        >
                            <Star className="size-4 fill-accent text-accent" />
                            Your favourites
                        </Button>
                        <Button
                            variant="ghost"
                            className="rounded-xl border border-zinc-200"
                            disabled={busy}
                            onClick={signOut}
                        >
                            Sign out
                        </Button>
                    </div>
                ) : (
                    <EmptyState
                        icon={<User className="size-6" />}
                        title="Sign in with Google"
                        description="Keep favourite places and stops on every device — and pick up where you left off."
                        className="flex-1 justify-center py-0"
                        action={
                            <Button
                                className="rounded-full px-6 shadow-md shadow-primary/20 transition-transform active:scale-[0.98]"
                                disabled={busy}
                                onClick={() => {
                                    setBusy(true)
                                    window.location.href = '/api/auth/google'
                                }}
                            >
                                Continue with Google
                            </Button>
                        }
                    />
                )}
                {oauthError && (
                    <p className="mt-4 text-center text-sm text-alert">
                        {ERROR_MSG[oauthError] ?? 'Sign-in failed.'}
                    </p>
                )}
            </div>
        </div>
    )
}
