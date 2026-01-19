/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Enable instrumentation for background jobs
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
