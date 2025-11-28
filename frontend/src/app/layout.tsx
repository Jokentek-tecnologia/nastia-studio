import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// --- CONFIGURAÇÃO DE SEO E COMPARTILHAMENTO ---
export const metadata: Metadata = {
  title: "NastIA Studio | Criativos com Inteligência Artificial",
  description: "Plataforma completa para gerar imagens e vídeos profissionais com IA. Crie anúncios, posts e criativos em segundos.",
  keywords: ["IA", "Marketing", "Gerador de Vídeo", "Gerador de Imagem", "Criativos", "NastIA", "Veo", "Gemini"],
  authors: [{ name: "Jokentek" }],
  icons: {
    icon: "/favicon.ico", // Você precisa colocar o arquivo favicon.ico na pasta public
    shortcut: "/app-logo.png",
    apple: "/app-logo.png",
  },
  openGraph: {
    title: "NastIA Studio - Crie o Impossível",
    description: "Transforme suas ideias em vídeos e imagens de alta conversão com Inteligência Artificial.",
    url: "https://studio.nastia.com.br",
    siteName: "NastIA Studio",
    images: [
      {
        url: "https://studio.nastia.com.br/app-logo.png", // A imagem que aparece no WhatsApp
        width: 800,
        height: 800,
        alt: "Logo NastIA Studio",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NastIA Studio",
    description: "Crie vídeos e imagens com IA em segundos.",
    images: ["https://studio.nastia.com.br/app-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json", // Para o Android (PWA)
};

// Configuração para Mobile (Cor da barra do navegador)
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}