import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  /** Nome do modulo mostrado no breadcrumb do cabecalho (apos "NEXODOC /"). */
  moduleName: string;
  /** Rotulo de versao opcional no canto direito do cabecalho. */
  version?: string;
  className?: string;
  /**
   * Full-bleed: o conteudo ocupa toda a largura e a altura restante abaixo do
   * cabecalho (sem max-w nem padding). Para telas que gerenciam o proprio layout
   * de colunas full-height (ex.: o shell conversacional do Nexo).
   */
  fullBleed?: boolean;
}

export function AppShell({
  children,
  moduleName,
  version,
  className,
  fullBleed = false,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "bg-background text-foreground",
        fullBleed ? "flex h-dvh flex-col" : "min-h-dvh",
        className,
      )}
    >
      <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-card/95 px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              NEXODOC
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-mono text-sm font-semibold">{moduleName}</span>
          </div>
          {version && (
            <span className="font-mono text-xs text-muted-foreground">{version}</span>
          )}
        </div>
      </header>
      {fullBleed ? (
        <main className="min-h-0 flex-1 px-4 py-4">{children}</main>
      ) : (
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      )}
    </div>
  );
}
