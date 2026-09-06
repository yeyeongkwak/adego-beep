import type { SupabaseClient } from '@supabase/supabase-js'

export const bulkInsert = async (
    supabase: SupabaseClient,
    table: string,
    rows: Record<string, unknown>[],
    chunkSize = 500
) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabase.from(table).insert(chunk)
        if (error) throw error
    }
    console.log(`[GTFS] ${table}: ${rows.length} rows`)
}
