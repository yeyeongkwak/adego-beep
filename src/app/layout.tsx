import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/next'

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
    applicationName: 'Adego Beep',
    appleWebApp: {
        capable: true,
        title: 'Adego Beep',
        statusBarStyle: 'default',
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <Providers>
                    <div className="min-h-dvh bg-gray-200">
                        <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col bg-gray-50 shadow-xl">
                            {children}
                        </div>
                    </div>
                </Providers>
                <Analytics />
            </body>
        </html>
    )
}
