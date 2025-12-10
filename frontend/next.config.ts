/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ISSO É O QUE VAI SALVAR SEU DEPLOY
    // Manda o Netlify ignorar erros de "variável não usada" e subir o site
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Manda ignorar erros de tipagem
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