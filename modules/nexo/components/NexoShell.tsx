"use client";

/**
 * NexoShell — base ChatGPT + slide (direção 2026-07-23). DERIVA a topologia do
 * latch `started`:
 * - welcome: sidebar | chat centralizado (o copiloto ocupa o centro).
 * - active (após enviar): sidebar | CANVAS (centro, organização dos arquivos) |
 *   copiloto (chat docado à direita, com o orb acima).
 *
 * Continuidade (§1): sidebar e copiloto SEMPRE no DOM — só o stage (canvas) monta.
 * O slide (FLIP nativo via `view-transition-name`) reposiciona o copiloto
 * centro→direita preservando histórico/scroll/foco do chat; o orb viaja junto.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ShellSplitter } from "./ShellSplitter";

export function NexoShell({
  started,
  barra,
  sidebar,
  stage,
  copilot,
}: {
  started: boolean;
  /**
   * A faixa do topo. O componente lá dentro decide não existir (devolve `null`)
   * quando não há obra lida nem auditoria rodando — por isso quem a esconde é o
   * `:empty` do CSS, e não uma condição aqui: o dado que decide mora dentro dos
   * providers, fora do alcance deste componente.
   *
   * A linha do grid, porém, existe sempre, e as áreas declaram morar na
   * segunda. Fazer a linha aparecer e sumir era o que esticava o chat: sem
   * barra, as colunas caíam na linha `auto` e cresciam com o histórico.
   */
  barra?: ReactNode;
  sidebar: ReactNode;
  stage: ReactNode;
  copilot: ReactNode;
}) {
  return (
    <div
      data-started={started}
      className={cn(
        "nexo-shell",
        started ? "nexo-shell--active" : "nexo-shell--welcome",
      )}
    >
      {/* A barra atravessa as colunas: ela fala da conversa inteira, não de
          uma das três áreas. */}
      {barra && <div className="nexo-shell__barra">{barra}</div>}
      <div className="nexo-shell__sidebar">{sidebar}</div>
      {/* Canvas (mapa do volume) entra no centro ao ativar; o chat desliza p/ a
          direita (FLIP via view-transition-name). Continuidade §1: o copiloto
          está SEMPRE no DOM, só muda de área no grid. */}
      {started && (
        <main className="nexo-shell__stage" aria-label="Organização dos arquivos">
          {stage}
        </main>
      )}
      {/* O separador só existe quando há canvas para dividir. */}
      {started && <ShellSplitter />}
      <aside className="nexo-shell__copilot" aria-label="Nexo">
        {copilot}
      </aside>

      {/*
        Tela estreita: dizer, em vez de degradar em silêncio.

        O Nexo é ferramenta de mesa — o parecer da auditoria e o mapa do volume
        são leitura lado a lado, e espremê-los numa coluna entregaria os dois
        pela metade. Antes desta tela, abaixo de 1024px a sidebar e o palco
        simplesmente sumiam e sobrava o chat solto: parecia defeito, não
        decisão. Fica no DOM sempre e é o CSS que decide mostrá-la, para não
        depender de medir a janela no cliente (o que pisca na primeira pintura).
      */}
      <div className="nexo-shell__estreito" role="note">
        <p className="nexo-shell__estreito-titulo">O Nexo pede uma tela maior</p>
        <p className="nexo-shell__estreito-texto">
          A auditoria e o mapa do volume são feitos para leitura lado a lado, a
          partir de 1024px de largura. Abra num computador — as conversas e os
          pareceres já auditados continuam aqui, esperando.
        </p>
      </div>
    </div>
  );
}
