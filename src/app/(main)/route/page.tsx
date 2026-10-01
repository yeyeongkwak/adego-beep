import { Suspense } from 'react'
import { RouteScreen } from '@/components/page/route/route-screen'

// RouteScreen reads query params (useSearchParams), which Next requires to be
// wrapped in a Suspense boundary so the rest can prerender.
export default function RoutePage() {
    return (
        <Suspense>
            <RouteScreen />
        </Suspense>
    )
}
