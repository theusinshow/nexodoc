"use client";

/**
 * NexoCopilot — orb (acima) + chat, a unidade que VIAJA centro→direita no slide.
 * É o nó reposicionado pelo shell (view-transition-name); o `NexoChat` dentro é
 * montado UMA vez (continuidade §1) e o orb viaja junto, sempre acima do chat.
 *
 * Welcome: orb grande + saudação, chat como caixa centralizada. Active: orb
 * pequeno + chat docado alto (direita).
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { AgentPopover } from "@/components/ui/agent-popover";
import { useComposer } from "../state/composer-controller";
import { AgentOrb, AgentStatusPopover, type AgentState } from "./agent-orb";
import type { AgentContext } from "../lib/agent-context";
import { useAuditoria } from "../state/auditoria-store";
import { NexoChat, type ReadStatus, type Attachment } from "./NexoChat";
import { SaudacaoDoNexo } from "./SaudacaoDoNexo";

export function NexoCopilot({
  started,
  nome,
  selos,
  onSend,
  onAttach,
  readStatus,
  agentState = "idle",
  fileCount = 0,
  activity = 0,
  context,
  pranchaFiles,
  memorialFile,
  memorialFatos = null,
  attachments,
  onRemoveAttachment,
  onTrocarPapelAnexo,
  onTurnStatus,
}: {
  started: boolean;
  /** Nome de quem está logado — a saudação usa o primeiro. */
  nome?: string | null;
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  readStatus?: ReadStatus | null;
  /** Estado do Nexo Core (derivado dos sinais do app pelo NexoWorkspace). */
  agentState?: AgentState;
  fileCount?: number;
  /** Atividade real 0..1: progresso da leitura ou cadência do texto. */
  activity?: number;
  /** Contexto derivado dos selos (o que o Nexo já entendeu) — popover do orb. */
  context: AgentContext;
  /** Pranchas originais retidas (bytes p/ montar o volume no chat). */
  pranchaFiles: File[];
  /** Memorial anexado (arquivo distinto) — alimenta a auditoria no chat. */
  memorialFile: File | null;
  /** O que a classificação leu do memorial — vai ao agente como fato. */
  memorialFatos?: {
    fileName: string;
    obra?: string | null;
    /** Prefeitura/órgão emissor lido do próprio memorial. */
    orgao?: string | null;
    municipio?: string | null;
    codigo?: string | null;
    /** Endereço da caracterização da obra — distingue obras de mesmo nome. */
    endereco?: string | null;
  } | null;
  /** Anexos com preview imediato (imagem/PDF). */
  attachments: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Corrige o papel lido do nome do arquivo (memorial ↔ prancha). */
  onTrocarPapelAnexo?: (id: string) => void;
  onTurnStatus?: (s: { thinking: boolean; error: boolean; responding: boolean }) => void;
}) {
  // Popover de status: clique no orb "espia a cabeça" do agente.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const composer = useComposer();

  /*
   * O CLIQUE NO ORBE TEM DUAS RESPOSTAS, porque tem duas situações.
   *
   * Com fatos lidos, ele abre o cartão — que é a razão de o cartão existir.
   * SEM fatos, abrir o cartão era um beco: na tela de boas-vindas ele cobria a
   * própria saudação para repetir, em letra menor, o convite que já estava
   * escrito atrás dele ("solte os PDFs"). Duas vezes a mesma frase, uma delas
   * tapando a outra.
   *
   * Então, vazio, o clique faz a coisa útil: leva o cursor para o campo. O orbe
   * deixa de ser um enfeite clicável e vira a porta de entrada.
   */
  const temFatos = context.folhas > 0;
  const ativarOrbe = () => {
    if (temFatos) setPopoverOpen((o) => !o);
    else composer.focus();
  };

  /*
   * O ORBE FALA A SAUDAÇÃO. Enquanto a frase se escreve, ele fica em
   * `responding` — que é o estado de quem está produzindo texto, e é
   * literalmente o que está acontecendo. Não é um estado inventado para a
   * animação: é o mesmo que ele usa quando responde no chat.
   *
   * Só vale na tela de boas-vindas. Depois que a conversa começa, quem manda no
   * orbe é o trabalho de verdade.
   */
  const [saudando, setSaudando] = useState(false);
  const orbState: AgentState = !started && saudando ? "responding" : agentState;
  const orbActivity = !started && saudando ? 0.5 : activity;

  // A auditoria não passa pelo turno do chat; sem ler o store, o orb ficaria
  // dizendo "pronto" durante os minutos em que o agente está trabalhando.
  const auditando = Boolean(useAuditoria().emCurso);

  // Rótulo do estado do orb (o orb já anima; isto só nomeia). O "pensando" É o orb.
  const working =
    agentState === "analyzing" ||
    agentState === "responding" ||
    agentState === "reading" ||
    agentState === "uploading";
  // Base do rótulo SEM reticência — a "…" animada é adicionada no render quando
  // está trabalhando (movimento = o Nexo está fazendo algo).
  const statusLabel =
    agentState === "error"
      ? "instabilidade"
      : agentState === "reading" || agentState === "uploading"
        ? "lendo os selos"
        : // A auditoria leva minutos: "pensando" por 6 minutos parece travado, e
          // o orb dizia "pronto" o tempo todo porque não sabia da análise.
          auditando
          ? "auditando o memorial"
          : working
            ? "pensando"
            : fileCount > 0
            ? `${fileCount} folha${fileCount > 1 ? "s" : ""} no contexto`
            : "pronto";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3",
        started ? "pt-[50px]" : "justify-center",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-2 pt-1 text-center">
        <AgentPopover
          open={popoverOpen && temFatos}
          onClose={() => setPopoverOpen(false)}
          label="Status do Nexo"
          anchor={
            <AgentOrb
              state={orbState}
              fileCount={fileCount}
              activity={orbActivity}
              size={started ? "compact" : "hero"}
              interactive
              onActivate={ativarOrbe}
            />
          }
        >
          {/* O mesmo `activity` que move o orbe alimenta a barra do cartão: um
              número só, duas leituras — a física e a numérica. */}
          <AgentStatusPopover
            state={agentState}
            context={context}
            progresso={activity}
          />
        </AgentPopover>
        {started ? (
          <p
            className={cn(
              "font-mono text-[11px] tracking-[0.04em]",
              working ? "nexo-status-working" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {statusLabel}
            {working && <span className="nexo-ellipsis" aria-hidden />}
          </p>
        ) : (
          /*
            A ENTRADA. As DUAS portas continuam nomeadas — a tela dizia só
            "montar" e falava só de pranchas, e quem chegava com um memorial na
            mão não sabia que a auditoria mora aqui —, mas agora quem as nomeia é
            o próprio Nexo, escrevendo.
          */
          <SaudacaoDoNexo nome={nome} onDigitando={setSaudando} />
        )}
      </div>

      <div
        className={cn(
          "min-h-0 w-full",
          started ? "flex-1" : "h-[460px] max-h-full",
        )}
      >
        <NexoChat
          selos={selos}
          onSend={onSend}
          onAttach={onAttach}
          readStatus={readStatus}
          pranchaFiles={pranchaFiles}
          memorialFile={memorialFile}
          memorialFatos={memorialFatos}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
          onTrocarPapelAnexo={onTrocarPapelAnexo}
          onTurnStatus={onTurnStatus}
        />
      </div>
    </div>
  );
}
