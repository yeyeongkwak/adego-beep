'use client'

import { useQuery } from '@tanstack/react-query'
import type { AppSession } from '@/types/auth'

export const SESSION_QUERY_KEY = ['session'] as const

export function useSession() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: SESSION_QUERY_KEY,
        queryFn: async (): Promise<AppSession | null> => {
            const res = await fetch('/api/auth/me')
            if (res.status === 401) return null
            if (!res.ok) throw new Error('Failed to fetch session')
            const json = (await res.json()) as { user: AppSession }
            return json.user
        },
        staleTime: 60_000,
    })

    return {
        user: data ?? null,
        signedIn: !!data,
        isLoading,
        error,
        refetch,
    }
}
