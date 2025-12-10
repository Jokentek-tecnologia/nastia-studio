/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Atenção: Isso permite o deploy mesmo com erros de lint (variáveis não usadas, etc)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Atenção: Isso permite o deploy mesmo com erros de tipo
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['lpiotuazwilvxhdjxgjo.supabase.co'], // Permite imagens do seu Supabase
    unoptimized: true,
  },
}

module.exports = nextConfig