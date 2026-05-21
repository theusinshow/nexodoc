import { CheckCircle2, FileUp, Loader2, ScanText } from "lucide-react";

type AuditProgressProps = {
  fileCount: number;
};

export function AuditProgress({ fileCount }: AuditProgressProps) {
  return (
    <section className="w-full max-w-[min(760px,100%)] rounded-lg border bg-card px-4 py-4 text-sm shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium">Auditoria em andamento</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Processando {fileCount} {fileCount === 1 ? "PDF" : "PDFs"} e
              aguardando a resposta padronizada do agente.
            </p>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="audit-progress-bar h-full w-1/2 rounded-full bg-primary" />
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
