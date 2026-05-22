import { CheckCircle2, FileUp, Loader2, ScanText, SearchCheck, X } from "lucide-react";

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
    <section className="w-full max-w-[760px] rounded-lg border bg-card/95 px-4 py-4 text-sm shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-10 shrink-0 items-center justify-center self-center rounded-md border border-primary/30 bg-primary/15 text-primary sm:self-start">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-medium">{getCurrentStep(elapsedMs, auditMode)}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {getAuditModeLabel(auditMode)} com {fileCount}{" "}
                {fileCount === 1 ? "arquivo" : "arquivos"}. Auditoria profunda
                com ate 24 blocos por arquivo, 5 blocos em paralelo e resultado
                separado por arquivo/comparacao.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-start gap-2 md:justify-end">
              <span className="flex h-8 min-w-10 items-center justify-center rounded-md border bg-[var(--nexodoc-recessed)] px-2 text-xs text-muted-foreground">
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

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="audit-progress-bar h-full w-1/2 bg-primary" />
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex min-w-0 items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <span>Arquivos recebidos</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <FileUp className="size-4 text-primary" />
              <span>PDFs em leitura</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <SearchCheck className="size-4 text-primary" />
              <span>5 em paralelo</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <ScanText className="size-4 text-primary" />
              <span>Ate 24 blocos</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
