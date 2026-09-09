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
 * A GRADE TEM QUATRO COLUNAS, e o número não é estético — é aritmética.
 *
 * Ela nasceu com três, e o padrão (dois `curto` + um `largo`) soma 1+1+2 = 4
 * células: numa grade de três, o `largo` não cabe na sobra da primeira linha,
 * desce inteiro para a segunda e deixa DOIS buracos — um no fim de cada linha.
 * A seção lia como uma prateleira meio vazia. Com quatro, o padrão fecha a
 * linha exatamente, e em `sm` (duas colunas) fecha duas linhas exatamente.
 *
 * A atividade é a única larga porque é uma lista de oito linhas com nome, verbo
 * e hora: numa coluna de 300px, cada linha viraria três.
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
    <section aria-labelledby="seu-espaco" className="mt-10 w-full">
      <div className="mb-3 flex items-baseline gap-3">
        <h2
          id="seu-espaco"
          className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Seu espaço
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <button
          type="button"
          onClick={aoPersonalizar}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
        >
          <Settings2 className="h-3 w-3" strokeWidth={1.6} aria-hidden />
          Personalizar
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
