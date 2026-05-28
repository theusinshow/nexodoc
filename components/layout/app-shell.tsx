import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("min-h-dvh bg-background text-foreground", className)}>
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              NEXODOC
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-mono text-sm font-semibold">Gerador de Capas</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">v1.0</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
