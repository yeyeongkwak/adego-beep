import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/next'
import { NavigationFooter } from '@/components/ui/navigation-footer'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? 'https://adegobeep.com'
    ),
    title: {
        default: 'Adelaide Go Beep',
        template: '%s | Adelaide Go Beep',
    },
    description:
        'Accurate real-time bus arrivals for Adelaide public transport',
    applicationName: 'Adelaide Go Beep',
    appleWebApp: {
        capable: true,
        title: 'Adelaide Go Beep',
        // default = opaque status bar. black-translucent washes the map white.
        statusBarStyle: 'default',
    },
    icons: {
        icon: [
            { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
    openGraph: {
        type: 'website',
        locale: 'en_AU',
        siteName: 'Adelaide Go Beep',
        title: 'Adelaide Go Beep',
        description:
            'Accurate real-time bus arrivals for Adelaide public transport',
        images: [
            {
                url: '/og.jpg',
                width: 1280,
                height: 720,
                alt: 'Adelaide Go Beep — real-time Adelaide bus arrivals',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Adelaide Go Beep',
        description:
            'Accurate real-time bus arrivals for Adelaide public transport',
        images: ['/og.jpg'],
    },
}

export const viewport: Viewport = {
    themeColor: '#002b5c',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" className="light">
            <body
                className={`${geistSans.variable} ${geistMono.variable} bg-white font-sans text-zinc-900 antialiased`}
            >
                <Providers>
                    {/* iOS 17+/standalone: a fixed top strip (≥6px, ≥80% wide)
                        with a solid bg cancels the forced status-bar blur. */}
                    <div
                        aria-hidden
                        className="pointer-events-none fixed top-0 right-0 left-0 z-[70] hidden h-2 bg-primary supports-[display-mode:standalone]:block"
                    />
                    <div className="h-dvh overflow-hidden bg-gray-200 supports-[display-mode:standalone]:bg-gray-50">
                        <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-gray-50 pb-[calc(4rem+env(safe-area-inset-bottom))] shadow-xl supports-[display-mode:standalone]:max-w-none supports-[display-mode:standalone]:shadow-none">
                            {children}
                        </div>
                    </div>
                    <NavigationFooter />
                </Providers>
                <Analytics />
            </body>
        </html>
    )
}
