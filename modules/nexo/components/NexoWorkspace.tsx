"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Waypoints, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NexoInputFile } from "../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fase 1 (casca): o intake de arquivos ja e real (alimenta o futuro Dossie),
 * mas o motor do agente so chega na Fase 2 — por isso a conversa fica em
 * estado explicito de "em construcao". Honesto: nada finge funcionar.
 */
export function NexoWorkspace() {
  const [files, setFiles] = useState<NexoInputFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      sizeBytes: f.size,
    }));
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
          <Waypoints className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-medium tracking-[-0.01em]">Nexo</h2>
            <Badge variant="warning">Beta</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Solte os PDFs do projeto e diga o que precisa. O Nexo vai orquestrar
            os modulos (LD, capas, volume, auditoria) e devolver os documentos,
            sempre confirmando cada decisao antes de gerar.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Intake — ja funcional */}
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Arquivos do projeto
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-ring"
          >
            <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium">Anexar PDFs</span>
            <span className="text-xs text-muted-foreground">
              Clique para escolher. Nada e enviado ainda: o motor chega na Fase 2.
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover ${file.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conversa — placeholder honesto ate a Fase 2 */}
        <div className="flex min-h-[420px] flex-col rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Conversa
            </span>
            <Badge variant="warning">Fase 2</Badge>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Waypoints}
              label="Motor do agente em construcao"
              description="Por enquanto voce ja pode anexar os arquivos. Quando o agente entrar (Fase 2), a conversa aqui vai propor LD, capas, volume e auditoria — confirmando cada passo."
            />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] px-3 py-2 opacity-60">
              <input
                disabled
                placeholder="Ex.: cria as LDs e as capas e junta o volume..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
