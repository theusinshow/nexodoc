import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Gerador de Capas - NexoDoc",
  description: "Gerador de capas tecnicas padronizadas",
};

export default function CapasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
