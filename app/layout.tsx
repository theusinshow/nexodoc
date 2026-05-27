import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
