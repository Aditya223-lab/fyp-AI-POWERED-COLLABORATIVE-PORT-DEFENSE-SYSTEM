/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  async rewrites() {
    // Proxy ONLY the explicit /backend/* prefix to your Spring backend.
    // /api/* paths stay local so NextAuth (/api/auth), Khalti (/api/payment),
    // and SSE (/api/events) keep working.
    return [
      {
        source: '/backend/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
      {
        source: '/ws/:path*',
        destination: 'http://localhost:8080/ws/:path*',
      },
    ];
  },
};

export default nextConfig;
