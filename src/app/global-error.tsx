'use client'

import './globals.css'

// Only fires when layout.tsx itself throws — replaces the whole root
// layout, so it has to render its own <html>/<body>.
export default function GlobalError({ reset }: { reset: () => void }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                    <span
                        aria-hidden
                        className="h-1 w-10 rounded-full bg-alert"
                    />
                    <h1 className="text-3xl font-semibold tracking-tight text-alert">
                        Something went wrong
                    </h1>
                    <button
                        onClick={() => reset()}
                        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    )
}
