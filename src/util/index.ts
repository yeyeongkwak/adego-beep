import type { SupabaseClient } from '@supabase/supabase-js'

export const bulkInsert = async (
    supabase: SupabaseClient,
    table: string,
    rows: Record<string, unknown>[],
    chunkSize = 500,
    concurrency = 5
) => {
    const chunks: Record<string, unknown>[][] = []
    for (let i = 0; i < rows.length; i += chunkSize) {
        chunks.push(rows.slice(i, i + chunkSize))
    }
    for (let i = 0; i < chunks.length; i += concurrency) {
        await Promise.all(
            chunks.slice(i, i + concurrency).map(async (chunk) => {
                const { error } = await supabase.from(table).insert(chunk)
                if (error) throw error
            })
        )
    }
    console.log(`[GTFS] ${table}: ${rows.length} rows`)
}
