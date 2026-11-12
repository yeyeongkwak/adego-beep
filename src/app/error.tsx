'use client'

import { StatusPage } from './_status/status-page'

// Catches render/server errors under this layout (real 500 status, same URL).
// Doesn't cover errors thrown *by* layout.tsx itself — that's global-error.tsx's job.

export default function Error({ reset }: { error: Error; reset: () => void }) {
    return (
        <StatusPage
            tone="error"
            title="Something went wrong"
            message={
                <button
                    onClick={() => reset()}
                    className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Try again
                </button>
            }
        />
    )
}
