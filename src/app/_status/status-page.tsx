// Shared shell for full-page states (landing copy, 404, error boundaries).
// Lives outside the route tree (`_status` prefix opts out of routing) so
// not-found.tsx/error.tsx/page.tsx can all render the same look.
export function StatusPage({
    title,
    message,
    tone = 'default',
}: {
    title: string
    message: React.ReactNode
    tone?: 'default' | 'error'
}) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <span
                aria-hidden
                className={`h-1 w-10 rounded-full ${tone === 'error' ? 'bg-alert' : 'bg-accent'}`}
            />
            <h1
                className={`text-3xl font-semibold tracking-tight ${tone === 'error' ? 'text-alert' : 'text-primary'}`}
            >
                {title}
            </h1>
            <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
                {message}
            </p>
        </main>
    )
}
