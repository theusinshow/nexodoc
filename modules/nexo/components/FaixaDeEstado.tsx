"use client";

/**
 * Faixa de estado do sistema — offline, sessão expirada, sem permissão.
 *
 * A regra que decide a cor (matriz do lote 9): a pergunta não é "quão grave é",
 * é O QUE ESTÁ EM RISCO PARA O ENGENHEIRO.
 *
 * - `atencao` (âmbar): reversível, nada se perdeu — sem conexão, sessão expirada.
 * - `info` (azul): nada quebrou, só a porta é outra — sem permissão.
 *
 * E a primeira frase é sempre sobre o que ele tem em risco, nunca sobre a
 * máquina: "o que você escreveu está guardado" vem antes de "a rede caiu".
 */

import type { ReactNode } from "react";
import { CloudOff, Info, Clock } from "lucide-react";

export type TipoDeFaixa = "offline" | "sessao" | "permissao";

const ESTILO: Record<
  TipoDeFaixa,
  { cor: string; fundo: string; borda: string; icone: typeof Info }
> = {
  offline: {
    cor: "var(--status-warning)",
    fundo: "var(--status-warning-bg)",
    borda: "var(--status-warning)",
    icone: CloudOff,
  },
  sessao: {
    cor: "var(--status-warning)",
    fundo: "var(--status-warning-bg)",
    borda: "var(--status-warning)",
    icone: Clock,
  },
  permissao: {
    cor: "var(--signal-info)",
    fundo: "var(--signal-info-bg)",
    borda: "var(--signal-info)",
    icone: Info,
  },
};

export function FaixaDeEstado({
  tipo,
  titulo,
  children,
  acao,
}: {
  tipo: TipoDeFaixa;
  titulo: string;
  /** A garantia: o que sobreviveu. Vem antes de qualquer explicação técnica. */
  children: ReactNode;
  acao?: ReactNode;
}) {
  const estilo = ESTILO[tipo];
  const Icone = estilo.icone;
  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-3 border-b px-4 py-2.5"
      style={{
        background: estilo.fundo,
        borderColor: `color-mix(in srgb, ${estilo.borda} 30%, transparent)`,
      }}
    >
      <Icone
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: estilo.cor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.07em]"
          style={{ color: estilo.cor }}
        >
          {titulo}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-foreground">{children}</p>
      </div>
      {acao}
    </div>
  );
}
