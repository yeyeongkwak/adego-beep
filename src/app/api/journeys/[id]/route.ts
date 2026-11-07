import { NextRequest, NextResponse } from 'next/server'
import { loadSavedJourney } from '@/lib/savedJourneys'

/* One saved journey by id. Only single-row lookups exist — there's
deliberately no list endpoint. Bad and unknown ids both 404, so the response
doesn't reveal what a valid id looks like.
*/
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const journey = await loadSavedJourney(id)
        if (!journey) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        return NextResponse.json({ journey })
    } catch (error) {
        console.warn('[journeys] load failed:', (error as Error).message)
        return NextResponse.json({ error: 'Could not load' }, { status: 500 })
    }
}
