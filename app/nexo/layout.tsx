import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Nexo",
  description: "Assistente que produz LD, capas, separatrizes, volume e auditoria",
};

export default function NexoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell moduleName="Nexo" version="beta" fullBleed>
      {children}
    </AppShell>
  );
}
