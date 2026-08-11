"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SavedResult } from "../state/conversation-store";
import { tamanhoLegivel } from "../lib/pendencia";

/** Mapeia os arquivos salvos p/ o formato do ResultLinks. */
export function toResultFiles(saved: SavedResult) {
  return saved.files.map((f) => ({
    label: f.label,
    url: f.url,
    name: f.name,
    primary: f.primary,
    sizeBytes: f.sizeBytes,
  }));
}

/**
 * Os links de download de um artefato já gerado.
 *
 * Recebe o resultado inteiro, e não só a lista de arquivos, de propósito: a
 * marca `bytesAusentes` mora nele, e um parâmetro à parte seria esquecido em um
 * dos lugares que chamam isto — que é exatamente como um aviso importante some.
 *
 * Vive em arquivo próprio (e não dentro do ConfirmationCard, onde nasceu)
 * porque o card do PLANO também precisa dele: era o único caminho que gerava a
 * LD sem oferecer o ODT, e duplicar o componente teria deixado o aviso de bytes
 * ausentes para trás na cópia.
 *
 * NÃO GERA NADA: os arquivos já estão no IndexedDB, e `url` é object URL vivo.
 * Nenhuma chamada de servidor, nenhum token.
 */
export function ResultLinks({
  summary,
  saved,
}: {
  summary?: string;
  saved: SavedResult;
}) {
  const files = toResultFiles(saved);
  if (files.length === 0) return null;
  return (
    <div className="nx-edge-6 flex flex-col gap-2 p-3 [--nx-fill:var(--nexodoc-recessed)]">
      {summary && <p className="text-sm">{summary}</p>}
      {/*
        O ARTEFATO EXISTE, OS BYTES NÃO ESTÃO AQUI.

        Acontece com conversa aberta noutra máquina: o registro atravessa a
        rede, os arquivos não — eles ficam no navegador que os gerou. Antes
        disto o arquivo simplesmente não aparecia, e um card sem botão de baixar
        parece defeito. Dizer o que houve e o que fazer custa duas linhas.
      */}
      {saved.bytesAusentes && (
        <p className="text-xs leading-snug text-[var(--status-warning)]">
          Gerado em outra máquina — os arquivos não estão neste navegador. Gere
          de novo para baixar.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {files.map((f) => {
          /* O peso do arquivo é decisão prática: o engenheiro escolhe o que
             anexa no e-mail da prefeitura por tamanho, e descobrir 18 MB só
             depois de baixar é tarde. */
          const peso = tamanhoLegivel(f.sizeBytes);
          return (
            <Button
              key={f.label}
              size="sm"
              variant={f.primary ? "default" : "outline"}
              asChild
            >
              <a href={f.url} download={f.name} data-prova="baixar-artefato">
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {f.label}
                {peso && (
                  <span className="ml-1.5 text-[11px] font-normal opacity-70">
                    {peso}
                  </span>
                )}
              </a>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
