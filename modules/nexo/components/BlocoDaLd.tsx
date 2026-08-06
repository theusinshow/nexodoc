"use client";

/**
 * A LD no card, ao lado da capa.
 *
 * Bloco COMPACTO de propósito: num volume misto são uma LD por disciplina, e
 * empilhar quatro tabelas inteiras faria um card que ninguém lê. O que se
 * confere antes de gerar é o título (que sai impresso no cabeçalho e tem de
 * casar com a separatriz) e se a contagem bate — não as 71 linhas.
 *
 * A lista de folhas vem de `ldPreview`, que o servidor já manda a cada turno e
 * que estava ÓRFÃ: o componente que a desenhava só recebe propostas que não são
 * capa/LD/separatriz desde que o `PlanoDeGeracao` assumiu esse caminho. Os
 * dados e o desenho existiam; tinham perdido a casa.
 */

import type { LdPreviewData } from "../types";

export function BlocoDaLd({
  titulo,
  onTitulo,
  somenteLeitura,
  codigo,
  revisao,
  preview,
  totalFolhas,
}: {
  titulo: string;
  onTitulo: (valor: string) => void;
  /** Num volume misto o título é o da disciplina — não se digita. */
  somenteLeitura?: boolean;
  codigo: string;
  revisao: string;
  preview?: LdPreviewData;
  totalFolhas: number;
}) {
  const linhas = preview?.rows.slice(0, 3) ?? [];
  const restantes = Math.max(0, (preview?.rows.length ?? totalFolhas) - linhas.length);
  const referencia = preview?.referenceTotal ?? null;
  const contadas = preview?.totalFolhas ?? totalFolhas;
  const bate = referencia === null || referencia === contadas;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        Lista de documentos
      </p>

      {somenteLeitura ? (
        <p className="rounded-sm border border-border bg-[var(--nexodoc-recessed)] px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
          {titulo || "—"}
        </p>
      ) : (
        <input
          aria-label="Título da LD"
          value={titulo}
          placeholder="título da lista de documentos"
          onChange={(e) => onTitulo(e.target.value)}
          className="w-full rounded-sm border border-dashed border-border bg-transparent px-2 py-1.5 text-sm font-medium outline-none focus:border-solid focus:border-[var(--ring)]"
        />
      )}

      <p className="font-mono text-[10px] text-muted-foreground">
        {codigo || "—"} · rev {revisao || "—"} · {contadas} folhas
        {referencia !== null && (
          <span
            className={
              bate ? "text-[var(--status-ok)]" : "text-[var(--status-warning)]"
            }
          >
            {" "}
            · carimbo diz {referencia}
            {bate ? " ✓" : " ✗"}
          </span>
        )}
      </p>

      {linhas.length > 0 && (
        <ul className="space-y-0.5">
          {linhas.map((r) => (
            <li
              key={r.file}
              className="truncate font-mono text-[10px] text-muted-foreground"
            >
              {r.sheet} · {r.file} · {r.description}
            </li>
          ))}
          {restantes > 0 && (
            <li className="font-mono text-[10px] text-muted-foreground/60">
              + {restantes} folhas
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
