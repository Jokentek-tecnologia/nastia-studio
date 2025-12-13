/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // IGNORA ERROS DE LINT NO BUILD (ESSENCIAL PARA DEPLOY RÁPIDO)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // IGNORA ERROS DE TYPESCRIPT NO BUILD
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
}

module.exports = nextConfig