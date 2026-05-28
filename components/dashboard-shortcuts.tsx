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
        handler: () => router.push("/audit"),
        description: "Ir para auditoria",
      },
      {
        key: "l",
        ctrl: true,
        handler: () => router.push("/ld"),
        description: "Ir para montagem de LDs",
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
