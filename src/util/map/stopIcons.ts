import type { StopMode } from '@/types/common'

export function buildStopIconUrl(
    fillColor: string,
    glyphPaths: string
): string {
    return (
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="${fillColor}" stroke="#FFFFFF" stroke-width="2.5"/>
                <g transform="translate(7,7) scale(0.75)" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    ${glyphPaths}
                </g>
            </svg>`
        )
    )
}

export const STOP_ICON_GLYPH: Record<StopMode, string> = {
    BUS: `<path d="M4 6 2 7"/>
         <path d="M10 6h4"/>
         <path d="m22 7-2-1"/>
         <rect width="16" height="16" x="4" y="3" rx="2"/>
         <path d="M4 11h16"/>
         <path d="M8 15h.01"/>
         <path d="M16 15h.01"/>
         <path d="M6 19v2"/>
         <path d="M18 21v-2"/>`,
    TRAM: `<rect width="16" height="16" x="4" y="3" rx="2"/>
         <path d="M4 11h16"/>
         <path d="M12 3v8"/>
         <path d="m8 19-2 3"/>
         <path d="m18 22-2-3"/>
         <path d="M8 15h.01"/>
         <path d="M16 15h.01"/>`,
    RAIL: `<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>
         <path d="m9 15-1-1"/>
         <path d="m15 15 1-1"/>
         <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>
         <path d="m8 19-2 3"/>
         <path d="m16 19 2 3"/>`,
}

export const STOP_ICON_DEFAULT_COLOR: Record<StopMode, string> = {
    BUS: '#002D62',
    TRAM: '#F59E0B',
    RAIL: '#2563EB',
}

export const STOP_ICON_URL: Record<StopMode, string> = {
    BUS: buildStopIconUrl(STOP_ICON_DEFAULT_COLOR.BUS, STOP_ICON_GLYPH.BUS),
    TRAM: buildStopIconUrl(STOP_ICON_DEFAULT_COLOR.TRAM, STOP_ICON_GLYPH.TRAM),
    RAIL: buildStopIconUrl(STOP_ICON_DEFAULT_COLOR.RAIL, STOP_ICON_GLYPH.RAIL),
}
