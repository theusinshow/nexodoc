"use client";

/**
 * Card de UM achado no canvas da auditoria. Fica logo abaixo da página a que
 * pertence, ligado a ela por uma linha — passar o cursor REALÇA o par, e clicar
 * abre o achado inteiro no parecer.
 *
 * O card diz O QUÊ; o pin na miniatura diz ONDE. Sem o card, a vista dependia do
 * tooltip do pin, que some quando o cursor sai — e um achado que só existe
 * enquanto o mouse está parado em cima não é uma leitura, é um esconde-esconde.
 *
 * O hover NÃO apaga mais o resto da cena (era o Modelo 2 do spec, o holofote):
 * ver a razão medida em [[audit-canvas-realce.tsx]].
 */

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { PONTO_DA_SEVERIDADE } from "@/lib/audit-status";
import { cn } from "@/lib/utils";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import type { FindingTier } from "@/lib/audit-report";
import { LARGURA_PAGINA, ALTURA_CARTAO } from "../lib/layout-auditoria";
import { corDaDisciplina, siglaDaDisciplina } from "../lib/disciplina-cor";
import { useAceso } from "./audit-canvas-realce";

export type FindingCardNodeData = {
  achadoId: string;
  severity: AuditSeverity;
  tier: FindingTier;
  tipo: string;
  evidencia: string;
  /** Página do achado; ausente no bloco "sem página localizada". */
  pageNumber?: number | null;
  /** A disciplina crua; vira sigla aqui. Vazia quando a página não a declarou. */
  disciplina?: string;
} & Record<string, unknown>;

export function FindingCardNode({ data }: NodeProps<Node<FindingCardNodeData>>) {
  const aceso = useAceso(data.achadoId);
  const sigla = siglaDaDisciplina(data.disciplina);
  const cor = corDaDisciplina(data.disciplina);

  return (
    /*
     * O aceso GANHA contorno; o resto continua como estava. É a inversão que
     * tirou o piscar: antes o destaque era feito escurecendo os outros 44 cards,
     * então mover o ponteiro apagava e reacendia a tela inteira.
     *
     * `cursor-pointer` porque o card agora abre o achado no parecer — afordância
     * antes do clique, não depois.
     */
    <div
      className={cn(
        "nx-edge-6 cursor-pointer overflow-hidden transition-[--nx-edge,box-shadow]",
        aceso ? "[--nx-edge:var(--ring)]" : "hover:[--nx-edge:var(--muted-foreground)]",
      )}
      style={{ width: LARGURA_PAGINA, height: ALTURA_CARTAO }}
    >
      <div className="flex h-full flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {/*
            A severidade é um PONTO, não uma faixa lateral: borda de acento com
            mais de 1px é proibida (DESIGN.md §11), e o ponto é o mesmo sinal que
            o veredito e o pin usam — o olho liga os três sem legenda.
          */}
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", PONTO_DA_SEVERIDADE[data.severity])}
          />
          <p className="truncate text-xs font-medium leading-tight">{data.tipo}</p>
          {/* A validação REBAIXA o incerto em vez de apagar (item 4). O canvas
              precisa dizer qual é qual, senão a sugestão vira achado. */}
          {data.tier === "sugestao" && (
            <Badge variant="outline" className="ml-auto">
              Sugestão
            </Badge>
          )}
        </div>
        {data.evidencia && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            “{data.evidencia}”
          </p>
        )}
        {/* A página no próprio card: a linha até a miniatura pode estar longe
            do olho, e o card precisa se sustentar sozinho. */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tabular-nums tracking-[0.05em] text-muted-foreground">
            {data.pageNumber ? `p. ${data.pageNumber}` : "sem página"}
          </p>
          {/*
            A DISCIPLINA — de quem é este erro.

            É a pergunta de quem delega: "isto é do estrutural ou do elétrico?".
            O canvas mostrava tipo, trecho e página, e não dizia a quem cobrar.

            A SIGLA carrega o sentido e a cor só acompanha (regra escrita em
            [[../lib/disciplina-cor]]): quem não distingue matiz continua lendo
            "EST". E disciplina que não cai numa das oito famílias fica SEM cor,
            em vez de ganhar um tom inventado que competiria com os três sinais
            de status.
          */}
          {sigla && (
            <span
              data-disciplina={sigla}
              title={data.disciplina}
              className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={cor ? { color: cor } : undefined}
            >
              {sigla}
            </span>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
