import type { MetadataRoute } from 'next'

// PWA manifest for Adelaide Go Beep.
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Adelaide Go Beep',
        short_name: 'Go Beep',
        description:
            'Real-time Adelaide bus arrivals — accurate GTFS-R timing.',
        start_url: '/',
        display: 'standalone',
        background_color: '#002b5c',
        theme_color: '#002b5c',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
