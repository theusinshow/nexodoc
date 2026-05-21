import { CheckCircle2, FileUp, Loader2, ScanText, X } from "lucide-react";

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

export function AuditProgress({
  fileCount,
  auditMode,
  elapsedMs,
  onCancel,
}: AuditProgressProps) {
  return (
    <section className="w-full max-w-[min(760px,100%)] rounded-none border bg-card px-4 py-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-none bg-accent text-accent-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Auditoria em andamento</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {getAuditModeLabel(auditMode)} processando {fileCount}{" "}
                {fileCount === 1 ? "PDF" : "PDFs"} e aguardando a resposta
                padronizada do agente.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-none border bg-background px-2 py-1 text-xs text-muted-foreground">
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

          <div className="h-2 overflow-hidden bg-muted">
            <div className="audit-progress-bar h-full w-1/2 bg-primary" />
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <span>Arquivos enviados</span>
            </div>
            <div className="flex items-center gap-2">
              <FileUp className="size-4 text-primary" />
              <span>PDFs em leitura</span>
            </div>
            <div className="flex items-center gap-2">
              <ScanText className="size-4 text-primary" />
              <span>Resposta em geração</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
