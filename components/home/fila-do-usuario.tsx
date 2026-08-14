"use client";

/**
 * O QUE ESTÁ COM VOCÊ.
 *
 * Agrupado por projeto e por auditoria, porque é assim que a pessoa pensa: "o
 * 063-26 está me esperando". Quarenta achados soltos numa lista não dizem por
 * onde começar.
 *
 * Abrir leva à auditoria INTEIRA, e não a uma vista só do que é seu: corrigir um
 * achado sem ver o resto do documento é como se conserta uma coisa e se quebra
 * outra.
 *
 * NÃO RENDERIZA NADA quando não há pendência — nem título, nem estado vazio. A
 * home só se justifica por mostrar trabalho, e uma seção "COM VOCÊ (nenhum)"
 * ocuparia o topo da tela todos os dias para dizer que não há o que fazer. Ver
 * o comentário de [[../../app/page.tsx]] sobre não virar parada no caminho.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

type Pendencia = {
  projectId: string;
  code: string;
  client: string;
  auditId: string;
  auditTitle: string;
  total: number;
  enviadoPor: string | null;
  enviadoEm: string;
};

function quandoFoi(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  if (minutos < 60 * 24) return `há ${Math.round(minutos / 60)}h`;

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

export function FilaDoUsuario() {
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);

  useEffect(() => {
    let vivo = true;

    fetch("/api/trabalho/meu")
      .then((r) => (r.ok ? r.json() : { pendencias: [] }))
      .then((d) => {
        if (vivo) setPendencias(d.pendencias ?? []);
      })
      .catch(() => {
        if (vivo) setPendencias([]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  /*
   * Enquanto não sabemos, não afirmamos nada. Mostrar "nada com você" e trocar
   * por cinco pendências meio segundo depois é pior do que não dizer: a pessoa
   * já virou a atenção para outro lugar.
   */
  if (pendencias === null || pendencias.length === 0) return null;

  return (
    <section aria-labelledby="fila-titulo" className="mb-10">
      <h2
        id="fila-titulo"
        className="mb-4 font-mono text-xs tracking-widest text-muted-foreground"
      >
        COM VOCÊ
      </h2>

      <ul className="flex flex-col gap-3">
        {pendencias.map((p) => (
          <li
            key={p.auditId}
            className="flex items-center justify-between gap-4 border border-border bg-[var(--nexodoc-recessed)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm text-foreground">
                {p.code} · {p.client}
              </p>
              <p className="truncate text-sm text-muted-foreground">{p.auditTitle}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {p.total} {p.total === 1 ? "achado" : "achados"}
                {p.enviadoPor ? ` · de ${p.enviadoPor}` : ""} · {quandoFoi(p.enviadoEm)}
              </p>
            </div>

            <Link
              href={`/nexo?auditoria=${encodeURIComponent(p.auditId)}`}
              className="shrink-0 border border-primary/30 bg-primary/10 px-4 py-2 font-mono text-xs text-primary transition hover:bg-primary/20"
            >
              ABRIR
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
