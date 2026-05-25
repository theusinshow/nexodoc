import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuditModeLabel, type AuditMode } from "@/lib/audit-mode";

type AuditProgressProps = {
  fileCount: number;
  auditMode: AuditMode;
  elapsedMs: number;
  onCancel: () => void;
};

function formatElapsed(elapsedMs: number) {
  return `${Math.max(1, Math.floor(elapsedMs / 1000))}s`;
}

function getCurrentStep(elapsedMs: number, auditMode: AuditMode) {
  const seconds = elapsedMs / 1000;

  if (seconds < 3) {
    return "Recebendo PDFs e preparando leitura";
  }

  if (seconds < 8) {
    return "Extraindo texto e identidade global";
  }

  if (seconds < 30) {
    return auditMode === "volume"
      ? "Auditando LD, selos, pranchas e consistencia do volume"
      : "Auditando coerencia interna e trechos reaproveitados";
  }

  return "Analisando blocos em paralelo; o servidor segue trabalhando";
}

export function AuditProgress({
  fileCount,
  auditMode,
  elapsedMs,
  onCancel,
}: AuditProgressProps) {
  return (
    <section className="w-full max-w-[760px] rounded-md border bg-card px-5 py-5 text-sm shadow-[var(--shadow-subtle)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-10 shrink-0 items-center justify-center self-center rounded-md border border-primary/15 bg-primary/8 text-primary sm:self-start">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-medium text-foreground">{getCurrentStep(elapsedMs, auditMode)}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {getAuditModeLabel(auditMode)} com {fileCount}{" "}
                {fileCount === 1 ? "arquivo" : "arquivos"}.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-start gap-2 md:justify-end">
              <span className="flex h-9 min-w-12 items-center justify-center rounded-md border bg-[var(--nexodoc-recessed)] px-2 font-mono text-xs text-muted-foreground">
                {formatElapsed(elapsedMs)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
              >
                <X />
                Cancelar
              </Button>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="audit-progress-bar h-full w-1/2 bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
