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

import {
  ROTULO_DA_PREFEITURA,
  type FichaDoDrop,
  type LinhaDaFicha,
} from "../lib/ficha-do-drop";
import { MarcaDaPrefeitura } from "./MarcaDaPrefeitura";

function Linha({ rotulo, valor, lido }: LinhaDaFicha) {
  /*
   * O SELO VAI NA LINHA DA PREFEITURA, ao lado do valor que o origina — que é
   * a regra do sistema inteiro: a marca nunca aparece longe do texto que ela
   * repete. Nas outras três linhas não há o que marcar.
   */
  const marcada = rotulo === ROTULO_DA_PREFEITURA;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
      <dt className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
        {rotulo}
      </dt>
      <dd
        className={
          marcada
            ? "flex min-w-0 flex-1 items-center gap-[9px]"
            : lido
              ? // `whitespace-pre-line`: no volume misto o título da capa é uma
                // disciplina POR LINHA — é assim que ele sai impresso.
                "min-w-0 flex-1 whitespace-pre-line text-[13px] font-medium leading-5 text-foreground"
              : "min-w-0 flex-1 text-[13px] italic leading-5 text-muted-foreground"
        }
      >
        {marcada && (
          <MarcaDaPrefeitura prefeitura={lido ? valor : null} forma="selo" />
        )}
        {marcada ? (
          <span
            className={
              lido
                ? "min-w-0 truncate text-[13px] font-medium leading-5 text-foreground"
                : "min-w-0 truncate text-[13px] italic leading-5 text-muted-foreground"
            }
          >
            {valor}
          </span>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

export function FichaDoDropCard({ ficha }: { ficha: FichaDoDrop }) {
  /*
   * A prefeitura que o CARIMBO leu — a mesma linha que o selo acompanha
   * embaixo. Não lida vira `null`, e a chapa cai no cinza.
   */
  const daPrefeitura = ficha.identidade.find(
    (l) => l.rotulo === ROTULO_DA_PREFEITURA,
  );
  const prefeitura = daPrefeitura?.lido ? daPrefeitura.valor : null;

  return (
    <div className="nexo-glass nexo-glass--weak nx-cut-8 max-w-[72ch] overflow-hidden">
      {/*
        O RECIBO ABRE, em mono e caixa alta: é a conta que fecha, e ela se lê de
        relance ou não serve para nada. Ver `reciboDoDrop`.

        A CHAPA ABRE AO LADO DELE, e é a única forma da marca que pode ser lida
        como imagem — cabe aqui porque esta ficha é a única tela em que a cidade
        é O ASSUNTO: ela existe para o engenheiro conferir SE É O PROJETO CERTO
        antes de mandar gerar. Uma por tela, nunca em lista.

        E ela trabalha AO CONTRÁRIO no caso que mais importa: cinza no topo é a
        ficha avisando, antes da conferência linha a linha, que esta capa vai
        sair sem prefeitura decidida. Hoje esse fato existe só como a palavra
        "não lido" na terceira linha, onde ninguém que está com pressa olha.
      */}
      <div className="flex items-center gap-3.5 border-b border-border/60 px-4 py-2">
        <MarcaDaPrefeitura prefeitura={prefeitura} forma="chapa" />
        <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
          {ficha.recibo}
        </p>
      </div>
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
