"use client";

import { useRouter } from "next/navigation";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

type DashboardShortcutsProps = {
  isAdmin?: boolean;
};

export function DashboardShortcuts({ isAdmin = false }: DashboardShortcutsProps) {
  const router = useRouter();

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "g",
        ctrl: true,
        handler: () => router.push("/"),
        description: "Ir para o dashboard",
      },
      {
        key: "a",
        ctrl: true,
        // A auditoria mora no Nexo; o atalho segue o produto, não a URL antiga.
        handler: () => router.push("/nexo"),
        description: "Ir para auditoria (Nexo)",
      },
      {
        key: "l",
        ctrl: true,
        // A montagem de LDs saiu; o atalho aponta para onde ela é feita agora.
        handler: () => router.push("/nexo"),
        description: "Ir para o Nexo (LD, capa, volume)",
      },
      ...(isAdmin
        ? [
            {
              key: "a",
              ctrl: true,
              shift: true,
              handler: () => router.push("/admin"),
              description: "Ir para painel admin",
            },
          ]
        : []),
    ],
  });

  return <KeyboardShortcutsHelp />;
}
