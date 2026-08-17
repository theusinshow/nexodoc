"use client";

/**
 * Consumo de IA DESTA conversa: um donut fatiado por modelo. O círculo está
 * SEMPRE completo — ele mostra composição, não fração de um teto. (Não existe
 * limite por usuário neste produto, e inventar um seria mentir.)
 *
 * Clicar abre a quebra por tarefa. Some enquanto não houve consumo.
 */

import { useState } from "react";

import { AgentPopover } from "@/components/ui/agent-popover";
import type { UsageSummary } from "@/server/nexo/usage/aggregate";

import { fatiasDaEscala } from "../lib/escala-de-dado";

const R = 7;
const CIRC = 2 * Math.PI * R;

function abreviar(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  return `${k.toFixed(k >= 10 ? 0 : 1).replace(".", ",")}k`;
}

function dinheiro(usd: number | null): string {
  return usd == null ? "—" : `$${usd.toFixed(3)}`;
}

export function UsageDonut({ data }: { data: UsageSummary | null }) {
  const [open, setOpen] = useState(false);

  if (!data || data.totalTokens <= 0) return null;

  /*
   * As cores saem da ESCALA DE DADO, e não de uma lista local.
   *
   * A lista daqui era a rampa teal, sob um comentário que assumia o desvio:
   * "distinção, não semântica". Só que o sistema não permite essa distinção —
   * teal significa interativo (§2, Regra do Acento Único), e fatia de gráfico
   * não se clica. Este anel fica no rodapé da conversa, ao lado de coisas que
   * SE clicam: quem aprendeu a regra ali mesmo, desaprendia aqui.
   */
  const cores = fatiasDaEscala(data.porModelo.length);

  // Cada fatia começa onde a anterior terminou (rotação -90 põe o zero no topo).
  // Acumula via `reduce` puro (sem mutar variável de fora) — o compilador do
  // React exige que o corpo do componente não reatribua estado entre iterações.
  const fatias = data.porModelo.reduce<
    Array<{ model: string; totalTokens: number; costUsd: number | null; len: number; offset: number; color: string }>
  >((acc, m, i) => {
    const anterior = acc[acc.length - 1];
    const offset = anterior ? anterior.offset + anterior.len : 0;
    const len = (m.totalTokens / data.totalTokens) * CIRC;
    // Sem `??` de reserva: `fatiasDaEscala` devolve exatamente um item por
    // modelo, e um fallback silencioso é como o teal voltaria sem ninguém ver.
    return [...acc, { ...m, len, offset, color: cores[i] }];
  }, []);

  return (
    <AgentPopover
      open={open}
      onClose={() => setOpen(false)}
      label="Consumo de IA desta conversa"
      panelClassName="w-[300px]"
      anchor={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title="Ver o gasto por passada — modelos, tokens e custo"
          aria-label={`Consumo desta conversa: ${data.totalTokens.toLocaleString("pt-BR")} tokens${
            data.totalCostUsd == null ? "" : `, ${dinheiro(data.totalCostUsd)}`
          }. Abrir a quebra por passada.`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <svg width="15" height="15" viewBox="0 0 18 18" className="-rotate-90" aria-hidden>
            {fatias.map((f) => (
              <circle
                key={f.model}
                cx="9"
                cy="9"
                r={R}
                fill="none"
                stroke={f.color}
                strokeWidth="2.5"
                strokeDasharray={`${f.len} ${CIRC - f.len}`}
                strokeDashoffset={-f.offset}
              />
            ))}
          </svg>
          {/*
            O DINHEIRO NA CARA, e não só atrás de um clique.

            O anel mostrava apenas tokens abreviados — "350k" não diz a ninguém
            se a conversa custou dez centavos ou seis dólares, e foi preciso
            abrir o banco para descobrir que uma auditoria tinha custado US$ 6,09.
            Token é unidade de máquina; dinheiro é a unidade em que a decisão de
            rodar de novo é tomada.

            O `·` separa as duas leituras sem virar mais um elemento: a barra
            inteira tem 9px de altura útil, e um ícone a mais aqui competiria com
            o botão de enviar.
          */}
          <span className="font-mono text-[9px] tabular-nums">
            {abreviar(data.totalTokens)}
            {data.totalCostUsd == null ? "" : ` · ${dinheiro(data.totalCostUsd)}`}
          </span>
          {/* O sinal de que ISTO ABRE. Sem ele, o anel se lê como enfeite — e
              foi exatamente como se leu. */}
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden className="opacity-60">
            <path
              d="M1 3l3 3 3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      }
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
        Consumo desta conversa
      </p>
      <table className="w-full text-[11px]">
        <tbody>
          {data.porTarefa.map((t) => (
            <tr key={`${t.flow}-${t.operation}-${t.model}-${t.falhou}`} className="align-baseline">
              <td className="py-0.5 pr-2 text-foreground">
                {t.label}
                {/*
                  A MARCA DA FALHA fica na LINHA, não num total no rodapé.
                  Chamada que trunca gasta o teto de saída inteiro e devolve
                  zero — é o pior caso, não um caso degradado —, e quem lê a
                  tabela precisa ver ONDE isso aconteceu para saber o que
                  consertar. Num rodapé, "US$ 4,32 perdidos" não diz em quê.
                */}
                {t.falhou ? (
                  <span
                    title="Esta chamada não completou. Os tokens foram cobrados mesmo assim."
                    className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--status-warning)]"
                  >
                    falhou
                  </span>
                ) : null}
              </td>
              <td className="py-0.5 pr-2 font-mono text-muted-foreground">{t.model}</td>
              <td className="py-0.5 pr-2 text-right font-mono tabular-nums text-foreground">
                {abreviar(t.totalTokens)}
              </td>
              <td className="py-0.5 text-right font-mono tabular-nums text-muted-foreground">
                {dinheiro(t.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="pt-1.5 text-muted-foreground" colSpan={2}>
              Total
            </td>
            <td className="pt-1.5 text-right font-mono tabular-nums text-foreground">
              {abreviar(data.totalTokens)}
            </td>
            <td className="pt-1.5 text-right font-mono tabular-nums text-foreground">
              {dinheiro(data.totalCostUsd)}
            </td>
          </tr>
        </tfoot>
      </table>
      {data.desperdicioUsd > 0 ? (
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-5 text-[var(--status-warning)]">
          {dinheiro(data.desperdicioUsd)} foram para chamadas que não completaram.
        </p>
      ) : null}
    </AgentPopover>
  );
}
