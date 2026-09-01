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
 * A SEPARAÇÃO DE 31/08/2026 tirou as duas do mesmo bloco.
 *
 * Elas nasceram juntas, uma embaixo da outra, e o resultado na tela era o
 * defeito que se via de longe: a home listava PROJETO três vezes na mesma
 * dobra — aqui, no cartão de "Seus projetos abertos" logo abaixo, e outra vez
 * na coluna da direita, que ainda por cima se chamava "Onde você parou" como
 * esta seção. Dois títulos iguais em telas diferentes é confusão; dois títulos
 * iguais na MESMA tela é a interface admitindo que não sabe o que está
 * dizendo.
 *
 * Então cada altura virou um componente, e cada um foi para o lugar em que
 * responde alguma coisa: a RETOMADA em largura total, no topo, porque é a
 * única ação primária desta tela; o TRABALHO RECENTE na coluna da direita, que
 * é onde o produto já guarda "o que passou". Ver `PainelDoUsuario`.
 *
 * SEM CARTÕES na lista. A DESIGN.md pede densidade e régua de 1px, e uma grade
 * de cartões iguais é o desenho que este produto recusa por escrito ("evitar
 * cards coloridos, ruído visual e ornamentação sem função"). Teal aparece uma
 * vez, no botão de retomar, que é o único interativo primário.
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

/**
 * A RETOMADA — uma linha e um botão, e nada mais.
 *
 * Ela não tem título próprio desde 31/08/2026, e a falta é de propósito. Um
 * "ONDE VOCÊ PAROU" em versalete acima de UMA linha é rótulo para um dado só:
 * ocupa a mesma altura do conteúdo que anuncia e empurra o botão para longe do
 * topo. O que a seção precisava dizer ("isto é a continuação do seu trabalho")
 * quem diz agora é o próprio botão, que carrega a palavra Continuar.
 *
 * SUPERFÍCIE DE CARTÃO, e não texto solto no fundo. Esta é a única ação
 * primária da primeira dobra; sobre o fundo da página ela lia como mais um
 * parágrafo com um botão no canto. Matte (§4) — o vidro desta tela mora só na
 * barra do topo.
 */
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
    <section
      aria-labelledby="onde-parou"
      className="nx-edge-8"
      style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
    >
      <h2 id="onde-parou" className="sr-only">
        Onde você parou
      </h2>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
        {/*
          O RÓTULO É A ETIQUETA DA LINHA, e não um cabeçalho de seção: ele fica
          NO bloco, à esquerda do dado que qualifica, na mesma altura. É a
          diferença entre gastar uma linha inteira para dizer "onde você parou"
          e gastar a margem esquerda de uma linha que já existia.
        */}
        <span className="shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Retomar
        </span>

        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-baseline gap-2.5">
            <span className="truncate text-[15px] font-medium leading-snug text-foreground">
              {daRetomada ? nomeDoProjeto(daRetomada) : ondeParou.title}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {quando(ondeParou.updatedAt)}
            </span>
          </p>
          <p className="m-0 mt-1 truncate font-mono text-[11.5px] leading-5 text-muted-foreground">
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
    </section>
  );
}

/**
 * O TRABALHO RECENTE — as OUTRAS pastas em que se mexeu.
 *
 * Ele mora na coluna da direita, e o vizinho de cima (a retomada) já levou a
 * pasta mais recente; por isso o `filter`. Sem ele, o primeiro item desta lista
 * seria a repetição literal do bloco anterior.
 *
 * ESTA LISTA SUBSTITUIU as "auditorias recentes" que ficavam aqui
 * (`painel.recentes`). As duas respondiam a mesma pergunta com dados
 * diferentes: aquela listava o TÍTULO da auditoria, esta lista a PASTA e o que
 * tem dentro — e a pasta é como o escritório chama as coisas. As duas juntas na
 * mesma coluna listavam `088-25` duas vezes com rótulos diferentes.
 *
 * Régua de 1px entre linhas, sem cartão e sem divisor vertical — o padrão de
 * tabela da DESIGN.md, que favorece ver muitas linhas de uma vez.
 */
/**
 * AS PASTAS QUE SOBRAM para a coluna da direita — todas menos a da retomada.
 *
 * Exportada porque o PAI precisa da MESMA resposta para decidir se a coluna
 * existe (ver `temRecente` em [[painel-do-usuario.tsx]]). Com a regra escrita
 * duas vezes, `projetos.length` podia ser 1 enquanto isto devolvia zero — e a
 * coluna de 336px nascia reservada para uma frase de consolo.
 */
export function pastasFora(
  projetos: readonly ProjetoRecente[],
  ondeParou: ConversaCrua | null,
): ProjetoRecente[] {
  return projetos.filter((p) => p.ultima.id !== ondeParou?.id);
}

export function TrabalhoRecente({
  ondeParou,
  projetos,
}: {
  ondeParou: ConversaCrua | null;
  projetos: ProjetoRecente[];
}) {
  const outros = pastasFora(projetos, ondeParou);

  if (outros.length === 0) {
    return (
      <p className="m-0 text-sm leading-normal text-muted-foreground">
        As outras pastas em que você mexer aparecem aqui.
      </p>
    );
  }

  return (
    <div className="nx-edge-8" style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}>
      <ul className="m-0 flex list-none flex-col px-3.5 py-0">
        {outros.map((p) => (
          <li key={p.chave || "sem-pasta"} className="border-b border-[#171c1f] last:border-0">
            {/*
              DUAS LINHAS, e não três colunas.

              A lista era `nome | resumo | quando` numa linha só, e isso servia
              enquanto ela ocupava a largura inteira da página. Nesta coluna de
              336px as três colunas não cabem: o resumo e a data são de largura
              fixa, então quem cede é sempre o NOME — e a home passou a mostrar
              "088-25 · CR…", que é justamente o dado pelo qual a pessoa
              procura o projeto.

              Agora o nome tem a linha inteira, e o resumo desce para a segunda
              com a data ao lado. Nada trunca até uns 200px de coluna.
            */}
            <Link
              href={CAMINHO(p.ultima.id)}
              className="group block py-2.5 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none"
            >
              <span className="block truncate text-sm text-foreground transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--nexodoc-accent)] group-focus-visible:text-[var(--nexodoc-accent)]">
                {nomeDoProjeto(p)}
              </span>
              <span className="mt-0.5 flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground">
                {/*
                  ANÁLISE EM CURSO toma o lugar do resumo: um projeto com
                  auditoria rodando é exatamente o que se quer ver da home sem
                  entrar em nada, e é mais urgente que a contagem de volumes.
                */}
                {p.emCurso ? (
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1 text-[var(--status-warning)]">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                    análise rodando
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{oQueTem(p)}</span>
                )}
                <span className="shrink-0 tabular-nums">{quando(p.atualizadoEm)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
