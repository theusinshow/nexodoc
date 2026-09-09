"use client";

/**
 * O HOOK DAS PREFERÊNCIAS — a ponte entre o armazém de strings e o objeto.
 *
 * [[lib/preferencias-da-home.ts]] é PURO (normaliza e valida, roda em node
 * cru) e [[lib/armazem-local.ts]] fala em STRING (é o que
 * `useSyncExternalStore` consegue comparar sem renderizar para sempre). Este
 * arquivo é a costura entre os dois, e existe só por causa dela.
 *
 * A MEMÓRIA DE UM VALOR SÓ é o que torna isto possível. `getSnapshot` precisa
 * devolver a MESMA referência enquanto nada mudou; `JSON.parse` devolve um
 * objeto novo toda vez. O par `ultimoBruto`/`ultimoValor` guarda a última
 * conversão: string igual, objeto igual. Um cache de uma entrada resolve o
 * caso inteiro, porque só existe uma chave de preferência.
 *
 * O NOME EM INGLÊS é a única concessão do arquivo, e é imposta pela
 * ferramenta: `react-hooks/rules-of-hooks` só reconhece como hook o que começa
 * com `use`, e sem esse reconhecimento ele para de conferir a ordem das
 * chamadas — a checagem que existe justamente para isto. `usarPreferencias`
 * era mais bonito e desligava o linter.
 *
 * MÓDULO E NÃO ESTADO DE COMPONENTE, de propósito: se a Home montar o hook em
 * dois lugares (o painel e o drawer), os dois leem o mesmo objeto e não duas
 * cópias que divergem na primeira escrita.
 */

import { useCallback, useSyncExternalStore } from "react";

import { assinarChave, brutoDoServidor, escreverBruto, lerBruto } from "@/lib/armazem-local";
import {
  normalizar,
  PADRAO,
  type PreferenciasDaHome,
} from "@/lib/preferencias-da-home";

const CHAVE = "nexodoc:home:v1";

let ultimoBruto: string | null = null;
let ultimoValor: PreferenciasDaHome = PADRAO;

const assinar = assinarChave(CHAVE);

function snapshot(): PreferenciasDaHome {
  const bruto = lerBruto(CHAVE);

  if (bruto !== ultimoBruto) {
    ultimoBruto = bruto;
    /*
     * O `try` do parse é separado do `try` do acesso: uma string gravada por
     * uma versão antiga (ou editada à mão no DevTools) pode não ser JSON, e
     * `normalizar` é quem trata o CONTEÚDO inválido — não o texto inválido.
     */
    let cru: unknown = null;
    try {
      cru = bruto ? JSON.parse(bruto) : null;
    } catch {
      cru = null;
    }
    ultimoValor = normalizar(cru);
  }

  return ultimoValor;
}

/** O que servidor e primeira hidratação enxergam. Mesmo objeto, sempre. */
function snapshotDoServidor(): PreferenciasDaHome {
  return PADRAO;
}

export function usePreferenciasDaHome(): [PreferenciasDaHome, (p: PreferenciasDaHome) => void] {
  const prefs = useSyncExternalStore(assinar, snapshot, snapshotDoServidor);

  const gravar = useCallback((p: PreferenciasDaHome) => {
    // NORMALIZA ANTES DE GRAVAR: o que entra no disco já entra válido, e a
    // leitura de amanhã não precisa confiar em quem escreveu hoje.
    escreverBruto(CHAVE, JSON.stringify(normalizar(p)));
  }, []);

  return [prefs, gravar];
}
