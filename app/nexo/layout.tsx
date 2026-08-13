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
   * O `AppShell` é só a moldura: fundo, cor e altura da janela. O cabeçalho que
   * ele tinha saiu — o topo do Nexo é a `BarraDoNexo`, que vive dentro dos
   * providers e por isso sabe de qual obra é a conversa aberta.
   */
  return <AppShell>{children}</AppShell>;
}
