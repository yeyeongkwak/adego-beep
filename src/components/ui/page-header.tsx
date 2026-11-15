/** Page top bar for Favourites / Profile — same brand cue as the home chip. */
export function PageHeader({
    title,
    subtitle,
}: {
    title: string
    subtitle?: string
}) {
    return (
        <header className="shrink-0 bg-primary px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/65 uppercase">
                Adelaide Go Beep
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-white">
                {title}
            </h1>
            {subtitle && (
                <p className="mt-1 text-sm leading-snug text-white/75">
                    {subtitle}
                </p>
            )}
        </header>
    )
}
