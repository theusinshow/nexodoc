import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Folhas Separatrizes - Nexo",
  description: "Gerador de folhas separatrizes de disciplinas",
};

export default function SeparatrizesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell moduleName="Folhas Separatrizes" version="v1.0">
      {children}
    </AppShell>
  );
}
