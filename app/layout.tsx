import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

// IBM Plex Sans/Mono (DESIGN.md secao 3): familia unica de engenharia,
// fora do look v0/IA. Pesos conforme a rampa: 400 body, 500 label/title,
// 600 display. IBM Plex nao e variavel no next/font, entao os pesos sao
// declarados explicitamente.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexo",
  description: "Documentação de projetos de engenharia, do carimbo ao volume",
  /*
   * O SVG é o ícone preferido (escala em qualquer densidade), mas os PNGs
   * existem porque nem todo lugar resolve SVG: aba antiga, atalho na área de
   * trabalho, e a tela de início do iOS — que usa o de 180.
   */
  icons: {
    icon: [
      { url: "/assets/logo.svg", type: "image/svg+xml" },
      { url: "/assets/logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/logo-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/assets/logo-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/assets/logo-32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-primary focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
        >
          Pular para o conteúdo
        </a>
        <TooltipProvider>
          <div id="main-content">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
