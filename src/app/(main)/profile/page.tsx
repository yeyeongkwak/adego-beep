import type { Metadata } from 'next'
import { ProfileScreen } from '@/components/page/profile/profile-screen'
import { getAppSession } from '@/util/oauthSession'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>
}) {
    const session = await getAppSession()
    const { error } = await searchParams
    return <ProfileScreen session={session} oauthError={error} />
}
