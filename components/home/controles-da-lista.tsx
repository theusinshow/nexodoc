"use client";

/**
 * OS CONTROLES DA LISTA — duas abas e um menu, na linha do título.
 *
 * NA LINHA DO TÍTULO, e não numa barra própria. Uma toolbar acima da lista
 * acrescenta 40px de cromo antes do primeiro projeto, numa tela que tem uma
 * dobra só e que acabou de ganhar duas seções. O título "SEUS PROJETOS
 * ABERTOS" já ocupa uma linha inteira com o canto direito vazio — os controles
 * vão para esse vazio, e o custo em altura é zero.
 *
 * AS ABAS SÃO ESCOPO, O MENU É ORDEM, e é uma distinção que a tela precisa
 * manter visível: aba muda O QUE a lista contém (uma consulta nova ao
 * servidor), menu muda a ORDEM do que já está lá (aritmética no navegador). Dar
 * a mesma forma às duas ensinaria que trocar de aba é barato como reordenar, e
 * a espera pela rede desmentiria.
 *
 * "TODOS" NÃO É "TODOS OS PROJETOS DO ESCRITÓRIO" — é todo o trabalho de
 * auditoria e achado do escritório. O link de rodapé para `/projetos`
 * continua, e continua sendo outra coisa: lá é a lista de CONTRATOS, aqui é a
 * lista de TRABALHO. Duas perguntas parecidas com respostas diferentes.
 */

import { Check, ChevronDown } from "lucide-react";

import { ORDENS, type OrdemDaLista } from "@/lib/atencao-do-painel";
import type { EscopoDaLista } from "@/lib/preferencias-da-home";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

export function ControlesDaLista({
  escopo,
  aoTrocarEscopo,
  ordem,
  aoTrocarOrdem,
}: {
  escopo: EscopoDaLista;
  aoTrocarEscopo: (e: EscopoDaLista) => void;
  ordem: OrdemDaLista;
  aoTrocarOrdem: (o: OrdemDaLista) => void;
}) {
  const rotuloDaOrdem = ORDENS.find((o) => o.id === ordem)?.rotulo ?? ORDENS[0].rotulo;

  return (
    <div className="flex shrink-0 items-center gap-3">
      {/*
        CONTROLE SEGMENTADO em superfície EMBUTIDA (`--nexodoc-recessed`), que é
        o que a DESIGN.md destina a ele. O fundo mais escuro que a página é o
        que diz "estas duas opções são a mesma coisa em dois estados" — sem ele
        seriam dois botões soltos, e dois botões soltos parecem duas ações.
      */}
      <div
        role="tablist"
        aria-label="Escopo da lista"
        className="nx-cut-5 flex items-center gap-0.5 bg-[var(--nexodoc-recessed)] p-0.5"
      >
        {(
          [
            ["meus", "Meus projetos"],
            ["todos", "Todos"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={escopo === id}
            onClick={() => aoTrocarEscopo(id)}
            className={cn(
              "nx-cut-4 cursor-pointer px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors duration-[var(--duration-fast)]",
              escopo === id
                ? "bg-[var(--secondary)] text-[var(--nexodoc-accent)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <Dropdown
        align="end"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
          >
            {/*
              O RÓTULO DA ORDEM ATUAL ficava aqui como texto morto ("mais
              parados primeiro"). Ele já dizia a coisa certa; só não dava para
              mexer. Virar gatilho não custa altura nenhuma — a mesma linha,
              agora com uma seta.
            */}
            {rotuloDaOrdem.toLowerCase()}
            <ChevronDown className="h-3 w-3" strokeWidth={1.8} aria-hidden />
          </button>
        )}
        panelClassName="min-w-[220px]"
      >
        {({ close }) => (
          <ul className="m-0 list-none p-1">
            {ORDENS.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    aoTrocarOrdem(o.id);
                    close();
                  }}
                  className={cn(
                    "nx-cut-4 flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-[var(--duration-fast)]",
                    ordem === o.id
                      ? "text-[var(--nexodoc-accent)]"
                      : "text-foreground hover:bg-[var(--nexodoc-raised)]",
                  )}
                >
                  <Check
                    className={cn("h-3 w-3 shrink-0", ordem === o.id ? "opacity-100" : "opacity-0")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {o.rotulo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dropdown>
    </div>
  );
}
