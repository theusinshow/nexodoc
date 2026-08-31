"use client";

/**
 * A FICHA DO DROP na tela — "de que projeto são estas folhas".
 *
 * A regra que a monta é pura e mora em [[ficha-do-drop.ts]]; aqui só se
 * desenha. A separação importa porque o que decide o que aparece (e o que
 * aparece como "não lido") é testável em node cru, e o desenho não precisa ser.
 *
 * DUAS SEÇÕES SEPARADAS POR UMA LINHA, e é o desenho carregando a distinção
 * que o produto inteiro protege: em cima o que o CARIMBO diz, embaixo o que o
 * SISTEMA propõe. Um traço entre as duas é mais barato que um parágrafo
 * explicando a diferença — e sobrevive à pressa de quem só confere o código.
 */

import type { FichaDoDrop, LinhaDaFicha } from "../lib/ficha-do-drop";

function Linha({ rotulo, valor, lido }: LinhaDaFicha) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
      <dt className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
        {rotulo}
      </dt>
      <dd
        className={
          lido
            ? // `whitespace-pre-line`: no volume misto o título da capa é uma
              // disciplina POR LINHA — é assim que ele sai impresso.
              "min-w-0 flex-1 whitespace-pre-line text-[13px] font-medium leading-5 text-foreground"
            : "min-w-0 flex-1 text-[13px] italic leading-5 text-muted-foreground"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

export function FichaDoDropCard({ ficha }: { ficha: FichaDoDrop }) {
  return (
    <div className="nexo-glass nexo-glass--weak nx-cut-8 max-w-[72ch] overflow-hidden">
      {/*
        O RECIBO ABRE, em mono e caixa alta: é a conta que fecha, e ela se lê de
        relance ou não serve para nada. Ver `reciboDoDrop`.
      */}
      <p className="border-b border-border/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
        {ficha.recibo}
      </p>
      <dl className="px-4 py-2">
        {ficha.identidade.map((l) => (
          <Linha key={l.rotulo} {...l} />
        ))}
      </dl>
      {ficha.propostos.length > 0 && (
        <>
          {/*
            A PROPOSTA SE ANUNCIA COMO PROPOSTA. Preenchimento que não se anuncia
            vai para a capa impressa sem ninguém olhar — é a mesma razão da nota
            de procedência do título, em `PlanoDeGeracao`.
          */}
          <p className="border-t border-border/60 px-4 pt-2 font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
            proposto — dá para mudar pelo chat
          </p>
          <dl className="px-4 pb-2.5 pt-1">
            {ficha.propostos.map((l) => (
              <Linha key={l.rotulo} {...l} />
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
