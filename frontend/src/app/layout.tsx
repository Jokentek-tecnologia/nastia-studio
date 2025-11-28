import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NastIA Studio | Criativos com Inteligência Artificial",
  description: "Gere imagens e vídeos profissionais para seus anúncios em segundos com a NastIA. A plataforma completa para criadores e agências.",

  // --- ADICIONE ESTA LINHA AQUI ---
  manifest: "/manifest.json",
  // --------------------------------

  keywords: ["IA", "Gerador de Imagem", "Gerador de Vídeo", "Marketing", "Criativos", "NastIA"],
  openGraph: {
    title: "NastIA Studio - Crie o Impossível",
    description: "Transforme ideias em vídeos e imagens com IA.",
    url: "https://studio.nastia.com.br",
    siteName: "NastIA Studio",
    images: [
      {
        url: "https://studio.nastia.com.br/app-logo.png", // Aproveitei para corrigir o nome da logo aqui também se precisar
        width: 800,
        height: 600,
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
