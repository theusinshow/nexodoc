"use client";

/**
 * SEU ESPAÇO — as ferramentas ao lado da bancada, DEPOIS da bancada.
 *
 * A posição é a decisão mais importante desta seção, e ela é o oposto do que
 * todo dashboard faz: os widgets ficam ABAIXO da lista de projetos. O
 * operacional é o produto — quem abre o NexoDoc abre para ver o que espera por
 * ele, não para ver um cronômetro. Um widget acima da lista rouba a primeira
 * dobra de quem só quer trabalhar, e a rouba TODO dia.
 *
 * TRÊS LIGADOS de cinco, e o padrão é enxuto de propósito. Cinco caixas na
 * estreia transformariam esta seção no que a tela recusa por escrito na
 * DESIGN.md ("evitar cards coloridos, ruído visual e ornamentação sem função").
 * Quem quiser os outros dois liga em dois cliques.
 *
 * A GRADE TEM TRÊS COLUNAS, e o número é aritmética, não gosto.
 *
 * Ela já foi de três e já foi de quatro, e as duas mudanças foram pela mesma
 * conta: o padrão tem que FECHAR a linha, senão a seção lia como prateleira
 * meio vazia. Com a atividade `largo` (dois de quatro), o padrão somava
 * 1+1+2 = 4 e fechava numa grade de quatro. Ela voltou a `curto`, o padrão
 * virou 1+1+1 = 3, e a grade acompanhou.
 *
 * `largo` continua funcionando (`sm:col-span-2`) para o widget que vier
 * precisar — hoje nenhum precisa, e é isso que a grade reflete.
 *
 * SEÇÃO INTEIRA SOME quando não há widget ligado. Um título "SEU ESPAÇO" sobre
 * o nada é a interface anunciando um vazio que a própria pessoa escolheu.
 */

import { Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { fichaPorId, widgetPorId } from "./widgets/registro";

export function SeuEspaco({
  widgets,
  aoPersonalizar,
}: {
  /** Ids ligados, na ordem. Já normalizados por `lib/preferencias-da-home`. */
  widgets: string[];
  aoPersonalizar: () => void;
}) {
  const montaveis = widgets
    .map((id) => ({ id, Componente: widgetPorId(id), ficha: fichaPorId(id) }))
    /*
     * O `Componente` nulo é a defesa contra o catálogo e o registro saírem de
     * sincronia — `<undefined />` derruba a árvore inteira por causa de um
     * widget opcional. `npm run test:home-preferencias` cobra as duas listas
     * sem navegador; isto é o cinto por cima do suspensório.
     */
    .filter((w): w is { id: string; Componente: React.ComponentType; ficha: ReturnType<typeof fichaPorId> } =>
      Boolean(w.Componente),
    );

  if (montaveis.length === 0) return null;

  return (
    /*
      O VÃO ERA DUPLO, e medi-lo foi o que revelou.
      O contêiner pai é `flex flex-col gap-8` (32px) e esta seção somava o
      próprio `mt-10` (40px) por cima: 72px entre o rodapé da lista e este
      título, numa tela em que a separação de seção mais larga em qualquer outro
      ponto é 32. Medido em 09/09/2026: 65px do fim do "Ver todos…" até aqui —
      "Seu espaço" lia como outra página.
      `mt-5` (20px) sobre os 32 do pai dá 52, que é ~28% a menos. O espaço
      negativo continua inteiro; o que saiu foi a soma acidental de dois
      espaçamentos que ninguém tinha somado.
    */
    <section aria-labelledby="seu-espaco" className="mt-5 w-full">
      <div className="mb-3 flex items-center gap-3">
        <h2
          id="seu-espaco"
          className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Seu espaço
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
        {/*
          PERSONALIZAR ganhou forma de controle, e continua secundário.

          Era texto de 11px com um ícone de 12, sem caixa e sem alvo: 16px de
          altura clicável no canto de uma seção, o que na prática quer dizer que
          só quem já sabia que ele existia o encontrava. Agora tem borda, 30px
          de alvo e o ícone em 14 — e continua longe de ser primário: sem fundo,
          em `--muted-foreground`, do outro lado do fio.
        */}
        <button
          type="button"
          onClick={aoPersonalizar}
          title="Escolher os widgets e como a lista de projetos se comporta"
          className="nx-cut-4 inline-flex shrink-0 cursor-pointer items-center gap-2 border border-border px-2.5 py-1.5 font-mono text-[11.5px] tracking-[0.04em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)] hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          Personalizar
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {montaveis.map(({ id, Componente, ficha }) => (
          <div
            key={id}
            className={cn("flex min-w-0", ficha?.tamanho === "largo" && "sm:col-span-2")}
          >
            {/*
              `items-start` e NÃO `items-stretch`, e a primeira versão errou
              nisto. Esticar iguala a altura da linha inteira à do widget mais
              alto — e como a Atividade tem oito linhas, o cronômetro ao lado
              virava uma caixa de 300px com um relógio de 64px no canto e
              duzentos e poucos pixels de nada. Widget tem a altura do que ele
              mostra; a linha desencontrada é o preço, e é barato.
            */}
            <Componente />
          </div>
        ))}
      </div>
    </section>
  );
}
