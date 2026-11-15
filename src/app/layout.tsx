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
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
            >
                <Providers>
                    <div className="h-dvh overflow-hidden bg-gray-200 supports-[display-mode:standalone]:bg-gray-50">
                        <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-gray-50 pb-16 shadow-xl supports-[display-mode:standalone]:max-w-none supports-[display-mode:standalone]:shadow-none">
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
