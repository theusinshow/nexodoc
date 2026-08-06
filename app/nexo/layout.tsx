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
  /*
   * Sem `version`: o rótulo "beta" ficava no alto da tela o tempo todo,
   * ocupando o canto oposto à marca com uma informação que não muda e sobre a
   * qual ninguém age. Cromo permanente tem de ganhar o lugar que ocupa.
   */
  return (
    <AppShell moduleName="Nexo" fullBleed>
      {children}
    </AppShell>
  );
}
