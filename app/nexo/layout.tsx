import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Nexo - NexoDoc",
  description: "Assistente que orquestra os modulos do NexoDoc",
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
