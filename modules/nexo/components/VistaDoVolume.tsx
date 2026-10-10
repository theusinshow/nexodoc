"use client";

/**
 * VOLUME OU LISTA, no mapa do volume (06/10/2026). O CANVAS É O PADRÃO, sempre
 * — é onde se organiza e, agora, onde se monta e baixa (cabeçalho de cada
 * tomo + doca). A Lista (capas A4 + tomos) é a alternativa sem canvas. A
 * Obra mostra todos os volumes do projeto, para quem monta vários de uma vez —
 * só aparece quando a conversa já tem projeto.
 */
import { CircleHelp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { DicaDeUmaVez } from "@/components/telas/comum/dica-de-uma-vez";

import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

import { PASSOS_DO_TOUR_DO_VOLUME } from "../lib/passos-do-tour-do-volume";
import { useRetomada } from "../lib/retomada-do-tour";
import { useConversation } from "../state/conversation-store";
import { DocaDaEntrega } from "./DocaDaEntrega";
import { PainelDoVolume } from "./PainelDoVolume";
import { TourDoNexo } from "./TourDoNexo";
import { VistaDaObra } from "./VistaDaObra";

export function VistaDoVolume({
  selos,
  mapa,
  onAbrirConversa,
}: {
  selos: SeloForLd[];
  mapa: ReactNode;
  /** Abre outra conversa (o mesmo caminho da barra lateral). */
  onAbrirConversa: (id: string) => void;
}) {
  const { results, projectId, pastaDaObra } = useConversation();
  const temObra = Boolean(pastaDaObra || projectId);
  const temDocumentos = results.some((r) => r.kind === "capa" || r.kind === "ld" || r.kind === "volume");
  const [vista, setVista] = useState<"obra" | "volume" | "lista">("volume");
  const lista = temDocumentos && vista === "lista";
  const obra = temObra && vista === "obra";
  /*
   * Numa conversa só de memorial não há volume: as abas "Obra | Volume" ficavam
   * sobre o palco vazio de quem veio auditar (07/10/2026, U08). Elas aparecem
   * quando há o que montar — folhas lidas ou documentos gerados.
   */
  const mostrarControle = temDocumentos || (temObra && selos.length > 0);
  /*
   * O PASSO A PASSO DO VOLUME (09/10/2026) não abre sozinho: montar é tarefa
   * em curso, e quem chega ao mapa recebe a dica curta (abaixo) que aponta o
   * "?". O holofote só quando a pessoa pede.
   */
  const [tour, setTour] = useState(false);
  const tourPelaMetade = Boolean(useRetomada("volume"));
  const comFolhas = selos.length > 0 || temDocumentos;

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-prova="vista-do-volume">
      {/* Abaixo da barra de navegação, à esquerda: em cima à direita ele cobria
          o título da coluna de conferência. */}
      {mostrarControle && (
        <div className="absolute left-3 top-14 z-20 flex w-[min(360px,calc(100%-24px))] flex-col items-start gap-2">
          <span className="flex items-center gap-1.5">
          <span className="nw-vistas" role="group" aria-label="Vista do volume" data-tour="abas-do-volume">
            {temObra && (
              <button type="button" aria-pressed={obra} onClick={() => setVista("obra")}>
                Obra
              </button>
            )}
            <button type="button" aria-pressed={!lista && !obra} data-tour="aba-volume" onClick={() => setVista("volume")}>
              Volume
            </button>
            {temDocumentos && (
              <button type="button" aria-pressed={lista} onClick={() => setVista("lista")}>
                Lista
              </button>
            )}
          </span>
          <button
            type="button"
            className="nw-volume-ajuda"
            data-tour="tour-do-volume"
            data-pela-metade={tourPelaMetade ? "" : undefined}
            aria-label={tourPelaMetade ? "Continuar o passo a passo de onde parei" : "Como montar o volume: cada parte do mapa"}
            title={tourPelaMetade ? "Continuar o passo a passo de onde parei" : "Como montar o volume: cada parte do mapa"}
            onClick={() => setTour(true)}
          >
            <CircleHelp aria-hidden />
            {tourPelaMetade && <span>Continuar</span>}
          </button>
          </span>
          {!obra && !lista && comFolhas && (
            <DicaDeUmaVez id="volume-canvas" titulo="Como ler este mapa">
              <p>
                Cada fileira é um tomo. <b>Montar</b>, no cabeçalho dela, junta tudo num PDF; arrastar uma folha muda o tomo dela. O
                &quot;?&quot; mostra cada parte.
              </p>
            </DicaDeUmaVez>
          )}
        </div>
      )}
      {tour && (
        <TourDoNexo
          passos={PASSOS_DO_TOUR_DO_VOLUME}
          rotulo="Passo a passo do mapa do volume"
          rotuloFinal="Entendi"
          roteiro="volume"
          aoSair={() => setTour(false)}
        />
      )}
      <div className="nx-area-do-volume relative min-h-0 flex-1">
        {obra ? (
          <VistaDaObra
            onAbrir={(id) => {
              // Abrir um volume leva ao canvas DELE — a Obra é o mapa, não o destino.
              setVista("volume");
              onAbrirConversa(id);
            }}
          />
        ) : lista ? (
          <PainelDoVolume selos={selos} />
        ) : (
          <>
            <div className="h-full" data-tour="canvas-do-volume">
              {mapa}
            </div>
            <DocaDaEntrega selos={selos} />
          </>
        )}
      </div>
    </div>
  );
}
