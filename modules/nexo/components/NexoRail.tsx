"use client";

/**
 * Rail esquerdo magro (Apêndice F, locked). Na v1 entra só com "＋ Nova conversa"
 * e "⚙️ Config" — SEM histórico ainda (histórico por data + persistência IndexedDB
 * chegam na v1.5). Colapsável para dar foco ao chat centralizado. O slide
 * welcome→active acontece na área principal; o rail fica estável.
 */

import { useState } from "react";
import { Plus, Settings, PanelLeftClose, PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function NexoRail({
  onNewConversation,
}: {
  onNewConversation?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Navegação do Nexo"
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border bg-card p-2 transition-[width] duration-150 ease-out",
        collapsed ? "w-[52px]" : "w-[200px]",
      )}
    >
      <RailButton
        icon={collapsed ? PanelLeft : PanelLeftClose}
        label={collapsed ? "Expandir" : "Recolher"}
        collapsed={collapsed}
        onClick={() => setCollapsed((c) => !c)}
      />
      <div className="my-1 h-px bg-border" />
      <RailButton
        icon={Plus}
        label="Nova conversa"
        collapsed={collapsed}
        onClick={onNewConversation}
      />
      <RailButton
        icon={Settings}
        label="Config"
        collapsed={collapsed}
        onClick={undefined}
      />
    </aside>
  );
}

function RailButton({
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        collapsed ? "justify-center" : "justify-start",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
