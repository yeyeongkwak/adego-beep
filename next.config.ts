import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    images: {
        // Google profile pictures on the profile page.
        remotePatterns: [{ hostname: 'lh3.googleusercontent.com' }],
    },
}

export default nextConfig
