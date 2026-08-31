"use client";

/**
 * A PRIMEIRA PERGUNTA DE QUEM ENTRA: onde eu estava.
 *
 * A home respondia isso olhando só AUDITORIAS e projetos com achado pendente.
 * Quem passou o dia montando VOLUME não via nada — volume não é auditoria nem
 * gera achado, e metade do produto ficava invisível na tela mais cara.
 *
 * DUAS ALTURAS, e a diferença entre elas é o desenho:
 *
 *   · a RETOMADA — uma linha, o trabalho mais recente, um botão. É a resposta
 *     literal à pergunta, e por isso não divide espaço com nada;
 *   · os PROJETOS — a lista do que se tocou, agrupada por pasta, que é como o
 *     escritório chama um projeto (`088-25 · CRICIUMA`).
 *
 * SEM CARTÕES. A DESIGN.md pede densidade e régua de 1px nas listas, e uma
 * grade de cartões iguais é o desenho que este produto recusa por escrito
 * ("evitar cards coloridos, ruído visual e ornamentação sem função"). Teal
 * aparece uma vez, no botão de retomar, que é o único interativo primário.
 */

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import type { ConversaCrua, ProjetoRecente } from "@/lib/trabalho-recente";

/** "há 4 min", "há 3 h", "ontem", "12/08" — a régua que a home já usa. */
function quando(ms: number, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** O nome que a pessoa reconhece: o contrato e a cidade, ou a chave crua. */
function nomeDoProjeto(p: ProjetoRecente): string {
  if (p.chave === "") return "Sem projeto";
  if (!p.codigo) return p.chave;
  return `${p.codigo} · ${p.cliente}`;
}

/**
 * O que a pasta tem dentro, em palavras.
 *
 * Contagem por TIPO, e não o total: "5 conversas" não diz nada sobre o
 * trabalho; "3 volumes · 1 auditoria" diz em que pé o projeto está.
 */
function oQueTem(p: ProjetoRecente): string {
  /*
   * SEM PASTA NÃO É UM PROJETO, e contá-lo por tipo mente sobre o que ele é:
   * "3 volumes · 55 auditorias" numa linha só anões as pastas reais logo acima
   * e sugere um projeto gigante onde há 58 conversas órfãs. Elas são o resíduo
   * de trabalho sem identidade — ver a limpeza guiada, na barra lateral.
   */
  if (p.chave === "") {
    // Sem "sem projeto" no fim: a linha já se chama assim, e repetir o rótulo
    // no dado é a palavra que não ganha o lugar dela.
    return `${p.conversas} conversa${p.conversas > 1 ? "s" : ""}`;
  }
  const partes: string[] = [];
  if (p.volumes > 0) partes.push(`${p.volumes} volume${p.volumes > 1 ? "s" : ""}`);
  if (p.auditorias > 0)
    partes.push(`${p.auditorias} auditoria${p.auditorias > 1 ? "s" : ""}`);
  if (partes.length === 0)
    return `${p.conversas} conversa${p.conversas > 1 ? "s" : ""}`;
  return partes.join(" · ");
}

const CAMINHO = (id: string) => `/nexo?conversa=${encodeURIComponent(id)}`;

export function OndeVoceParou({
  ondeParou,
  projetos,
}: {
  ondeParou: ConversaCrua | null;
  projetos: ProjetoRecente[];
}) {
  if (!ondeParou) return null;

  const daRetomada = projetos.find((p) => p.ultima.id === ondeParou.id);

  return (
    /*
     * TETO DE LARGURA. Solta, a seção esticava até 1436px e o nome do projeto
     * ficava a mais de mil pixels do dado que o descreve — o olho tinha de
     * atravessar a tela para ligar "116-25 · SAO JOSE" a "1 volume · há 7 h".
     * A régua da DESIGN.md vale aqui: densidade é ver muitas linhas de uma vez,
     * não esparramar cada uma.
     */
    <section aria-labelledby="onde-parou" className="w-full max-w-[880px]">
      <h2
        id="onde-parou"
        className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        Onde você parou
      </h2>

      {/*
        A RETOMADA. Uma linha, e ela é a única coisa com peso de ação nesta
        seção — o resto é navegação. Por isso o botão sólido aqui e só aqui.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 pb-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-baseline gap-2.5">
            <span className="truncate text-[15px] font-medium leading-snug text-foreground">
              {daRetomada ? nomeDoProjeto(daRetomada) : ondeParou.title}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {quando(ondeParou.updatedAt)}
            </span>
          </p>
          <p className="m-0 mt-1 font-mono text-[11.5px] leading-5 text-muted-foreground">
            {daRetomada ? `${ondeParou.title} · ${oQueTem(daRetomada)}` : ondeParou.title}
            {daRetomada?.emCurso ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--status-warning)]">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                análise rodando
              </span>
            ) : null}
          </p>
        </div>

        <Link
          href={CAMINHO(ondeParou.id)}
          className="nx-edge-7 inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-colors [--nx-edge:var(--primary)] [--nx-fill:var(--primary)] hover:[--nx-edge:var(--primary-hover)] hover:[--nx-fill:var(--primary-hover)] focus-visible:outline-none"
        >
          Continuar
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>

      {/*
        OS PROJETOS. Régua de 1px entre linhas, sem cartão e sem divisor
        vertical — o padrão de tabela da DESIGN.md, que favorece ver muitas
        linhas de uma vez.
      */}
      {projetos.length > 1 ? (
        <ul className="m-0 list-none p-0">
          {projetos
            .filter((p) => p.ultima.id !== ondeParou.id)
            .map((p) => (
              <li key={p.chave || "sem-pasta"} className="border-b border-border/40">
                <Link
                  href={CAMINHO(p.ultima.id)}
                  className="group flex items-baseline gap-3 px-1 py-2.5 transition-colors hover:bg-[var(--accent)] focus-visible:bg-[var(--accent)] focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {nomeDoProjeto(p)}
                  </span>
                  {/*
                    ANÁLISE EM CURSO aparece NA LINHA, e não só na retomada: um
                    projeto com auditoria rodando é exatamente o que se quer ver
                    da home sem entrar em nada.
                  */}
                  {p.emCurso ? (
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[var(--status-warning)]">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      rodando
                    </span>
                  ) : (
                    <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">
                      {oQueTem(p)}
                    </span>
                  )}
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {quando(p.atualizadoEm)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
