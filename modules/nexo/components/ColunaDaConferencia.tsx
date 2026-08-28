"use client";

/**
 * A LD AO LADO DO MAPA — a conferência vira gesto, e deixa de ser relatório.
 *
 * O trabalho que a prefeitura faz é este: correr a lista, folha a folha, e
 * perguntar se cada linha bate com a prancha. O produto já sabia responder — a
 * conferência leve roda desde sempre — e entregava a resposta como um bloco de
 * texto agregado ("pranchas com revisões divergentes"), que obriga quem lê a
 * procurar de novo, no canvas, qual prancha é.
 *
 * A COLUNA É A MESMA LISTA DO CANVAS, na mesma ordem. Não é uma segunda
 * verdade: as linhas saem dos mesmos nós, e quem marca cada uma é o índice de
 * `conferencia-por-folha.ts`. Clicar na linha seleciona o nó; selecionar o nó
 * (mouse, seta ou `E`) rola a coluna até ele.
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { DivergenciaDaFolha } from "../lib/conferencia-por-folha";

export interface LinhaDaConferencia {
  /** O id do NÓ no canvas — é por ele que a seleção viaja. */
  idDoNo: string;
  numero: number | null;
  sigla: string;
  titulo: string;
  divergencia?: DivergenciaDaFolha;
}

/** A cor do sinal. Verde não entra: "sem divergência" é o normal, e o normal é mudo. */
const COR: Record<string, string> = {
  critico: "var(--status-critical)",
  aviso: "var(--status-warning)",
  info: "var(--muted-foreground)",
};

export function ColunaDaConferencia({
  linhas,
  selecionado,
  onEscolher,
}: {
  linhas: readonly LinhaDaConferencia[];
  selecionado: string | null;
  onEscolher: (idDoNo: string) => void;
}) {
  const daVez = useRef<HTMLButtonElement | null>(null);

  /*
   * A COLUNA SEGUE O CANVAS. Sem isto, andar de seta pelas duzentas folhas
   * deixava a linha correspondente fora da vista — a sincronização existiria só
   * num sentido, e o sentido que falta é justamente o de quem confere sem tirar
   * a mão do teclado.
   *
   * `nearest`: rolar sempre para o centro faria a lista saltar a cada seta,
   * mesmo quando a linha já estava visível.
   */
  useEffect(() => {
    daVez.current?.scrollIntoView({ block: "nearest" });
  }, [selecionado]);

  if (linhas.length === 0) return null;

  const comDivergencia = linhas.filter((l) => l.divergencia).length;

  return (
    <aside
      aria-label="Conferência da LD"
      /*
       * OCUPA ESPAÇO, não flutua. Como painel absoluto ela cobria a barra do
       * canvas ("+ Folha", "+ Tomo") e a dica dos atalhos — e o `fitView`
       * continuava enquadrando o volume por baixo dela, então metade das folhas
       * nascia escondida. Como irmã do fluxo, o canvas simplesmente fica mais
       * estreito e tudo continua visível.
       */
      className="nx-cut-8 flex w-[210px] shrink-0 flex-col overflow-hidden bg-[var(--nexodoc-panel)]"
    >
      <div className="border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
          Conferência
        </p>
        {/*
          O NÚMERO DIZ O ESTADO sem cor: "3 de 24 com divergência" é lido igual
          em preto e branco e por quem não distingue matiz — e o zero é dito,
          não subentendido, porque "nada aqui" e "não conferido" são coisas
          diferentes.
        */}
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
          {comDivergencia} de {linhas.length} com divergência
        </p>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {linhas.map((linha) => {
          const escolhida = linha.idDoNo === selecionado;
          return (
            <li key={linha.idDoNo}>
              <button
                type="button"
                ref={escolhida ? daVez : undefined}
                onClick={() => onEscolher(linha.idDoNo)}
                aria-current={escolhida || undefined}
                title={linha.divergencia?.motivos.join(" · ") || linha.titulo}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border/60 px-3 py-1.5 text-left outline-none transition-colors duration-[var(--duration-fast)]",
                  escolhida
                    ? "bg-[var(--accent)]"
                    : "hover:bg-[var(--accent)]/60",
                )}
              >
                {/*
                  O fio à esquerda é o sinal: presente só onde há divergência.
                  Linha limpa não ganha marca nenhuma — um "ok" em cada uma das
                  duzentas linhas é ruído que apaga as três que importam.
                */}
                <span
                  aria-hidden
                  className="mt-0.5 h-3 w-0.5 shrink-0 rounded-full"
                  style={{
                    background: linha.divergencia
                      ? COR[linha.divergencia.severidade]
                      : "transparent",
                  }}
                />
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {linha.numero == null
                    ? "—"
                    : String(linha.numero).padStart(2, "0")}
                </span>
                {linha.sigla && (
                  <span className="font-mono text-[10px] tracking-[0.05em] text-muted-foreground">
                    {linha.sigla}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  {linha.titulo || "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
