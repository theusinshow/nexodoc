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
 * E a faixa que é NOTÍCIA se fecha (`aoFechar`); a que é BLOQUEIO, não — ver a
 * prop.
 *
 * E a primeira frase é sempre sobre o que ele tem em risco, nunca sobre a
 * máquina: "o que você escreveu está guardado" vem antes de "a rede caiu".
 */

import type { ReactNode } from "react";
import { CloudOff, Info, Clock, FileWarning, X } from "lucide-react";

export type TipoDeFaixa = "offline" | "sessao" | "permissao" | "documento";

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
  /*
   * Algo no DOCUMENTO precisa de atenção — título faltando, campo em branco.
   * Âmbar como os outros avisos, mas com ícone de arquivo: não é a conexão nem
   * a sessão que está ruim, é o material.
   */
  documento: {
    cor: "var(--status-warning)",
    fundo: "var(--status-warning-bg)",
    borda: "var(--status-warning)",
    icone: FileWarning,
  },
};

export function FaixaDeEstado({
  tipo,
  titulo,
  children,
  acao,
  aoFechar,
}: {
  tipo: TipoDeFaixa;
  titulo: string;
  /** A garantia: o que sobreviveu. Vem antes de qualquer explicação técnica. */
  children: ReactNode;
  acao?: ReactNode;
  /**
   * Dispensa a faixa. SÓ passe onde ela é NOTÍCIA, não onde é BLOQUEIO.
   *
   * "As folhas vieram da memória" é notícia: quem já leu e decidiu que está
   * certo não precisa da faixa ocupando o topo da tela pelo resto da conversa.
   * "A leitura parou no meio" e "você está offline" são o contrário — fechar
   * esconderia trabalho que não terminou, e a faixa é a única forma de saber.
   */
  aoFechar?: () => void;
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
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          aria-label={`Fechar aviso: ${titulo}`}
          title="Fechar"
          className="-mr-1 shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
