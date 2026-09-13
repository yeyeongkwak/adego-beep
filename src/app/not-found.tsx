import { StatusPage } from './_status/status-page'

// Next renders this in place of any unmatched route (or a manual notFound()
// call) — same URL, real 404 status, no redirect needed.
export default function NotFound() {
    return (
        <StatusPage
            title="404 — Page not found"
            message="That page doesn't exist."
        />
    )
}
