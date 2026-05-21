import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexoDoc",
  description: "Auditoria documental para projetos de engenharia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
