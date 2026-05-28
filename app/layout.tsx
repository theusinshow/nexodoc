import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexoDoc",
  description: "Plataforma documental para projetos de engenharia",
  icons: {
    icon: [{ url: "/assets/logo.svg", type: "image/svg+xml" }],
    shortcut: "/assets/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased">
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
