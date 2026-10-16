/**
 * O DICIONÁRIO pt-BR da conferência de grafia — a rede determinística.
 *
 * Hunspell de verdade, em WebAssembly (`hunspell-asm`), com o dicionário do
 * VERO (`dictionary-pt`). Medido em 16/10/2026: carrega em ~250 ms e confere 50
 * palavras em ~1 s na primeira passada. O `nspell` (JS puro) foi descartado:
 * levou mais de 2 minutos só para montar as regras de flexão do português.
 *
 * Uma instância por processo, criada na primeira conferência. O dicionário não
 * muda entre chamadas, e montar de novo a cada pedido seria pagar o carregamento
 * em toda conferência.
 */
import type { Hunspell } from "hunspell-asm";

import { palavrasParaDicionario, type LinhaUnica, type SuspeitaDoDicionario } from "./grafia-core";
import { EXCECOES_DA_GRAFIA } from "./grafia-excecoes";

let instancia: Promise<Hunspell> | null = null;

async function criar(): Promise<Hunspell> {
  const [{ loadModule }, { default: dicionario }] = await Promise.all([
    import("hunspell-asm"),
    import("dictionary-pt"),
  ]);
  const fabrica = await loadModule();
  const aff = fabrica.mountBuffer(new Uint8Array(dicionario.aff), "pt-BR.aff");
  const dic = fabrica.mountBuffer(new Uint8Array(dicionario.dic), "pt-BR.dic");
  const hunspell = fabrica.create(aff, dic);
  for (const palavra of EXCECOES_DA_GRAFIA) hunspell.addWord(palavra);
  return hunspell;
}

function dicionario(): Promise<Hunspell> {
  if (!instancia) {
    instancia = criar().catch((err) => {
      // Falhou uma vez, tenta de novo na próxima conferência em vez de ficar
      // preso a uma promessa rejeitada até o processo reiniciar.
      instancia = null;
      throw err;
    });
  }
  return instancia;
}

/**
 * As palavras que o dicionário não conhece, com as linhas em que aparecem.
 *
 * Linha de fonte RECUPERADA não entra: os acentos dela vêm do reparo, e cada
 * "REVITALIZAdO" viraria uma suspeita que não é do documento.
 */
export async function suspeitasDoDicionario(
  linhas: readonly LinhaUnica[],
  teto = 300,
): Promise<SuspeitaDoDicionario[]> {
  const hunspell = await dicionario();
  const porPalavra = new Map<string, SuspeitaDoDicionario>();
  const conhecidas = new Map<string, boolean>();

  for (const linha of linhas) {
    if (linha.recuperada) continue;
    for (const palavra of palavrasParaDicionario(linha.texto)) {
      const chave = palavra.toLocaleLowerCase("pt-BR");
      let ok = conhecidas.get(chave);
      if (ok === undefined) {
        ok = hunspell.spell(palavra) || hunspell.spell(chave);
        conhecidas.set(chave, ok);
      }
      if (ok) continue;
      const suspeita = porPalavra.get(chave);
      if (suspeita) {
        if (!suspeita.linhas.includes(linha.n)) suspeita.linhas.push(linha.n);
      } else if (porPalavra.size < teto) {
        porPalavra.set(chave, { palavra, linhas: [linha.n] });
      }
    }
  }
  return [...porPalavra.values()];
}
