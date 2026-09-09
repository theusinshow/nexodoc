"use client";

/**
 * O REGISTRO — onde o `id` do catálogo vira componente.
 *
 * O catálogo mora em [[lib/preferencias-da-home.ts]] e é DADO PURO, sem React:
 * é o que deixa a normalização de preferência rodar em node cru, sem
 * navegador. Este arquivo é a outra metade — o mapa de `id` para componente —, e
 * a separação existe só por causa dessa fronteira.
 *
 * As duas listas podem sair de sincronia (id novo no catálogo sem componente
 * aqui, ou o contrário), e um `undefined` neste mapa monta `<undefined />`, que
 * derruba a Home inteira por causa de um widget opcional. Duas defesas:
 * `npm run test:home-preferencias` compara as listas sem navegador, e
 * `widgetPorId` devolve `null` em vez de explodir.
 */

import type * as React from "react";

import { CATALOGO, IDS_DO_CATALOGO } from "@/lib/preferencias-da-home";
import { WidgetAtividade } from "./atividade";
import { WidgetConversor } from "./conversor";
import { WidgetFoco } from "./foco";
import { WidgetGerados } from "./gerados";
import { WidgetRascunho } from "./rascunho";

const COMPONENTES: Record<string, React.ComponentType> = {
  foco: WidgetFoco,
  rascunho: WidgetRascunho,
  atividade: WidgetAtividade,
  conversor: WidgetConversor,
  artefatos: WidgetGerados,
};

/** Os ids que ESTE arquivo sabe montar. O teste cobra que batam com o catálogo. */
export const IDS_COM_COMPONENTE = Object.keys(COMPONENTES);

export function widgetPorId(id: string): React.ComponentType | null {
  return COMPONENTES[id] ?? null;
}

export function fichaPorId(id: string) {
  return CATALOGO.find((w) => w.id === id) ?? null;
}

export { CATALOGO, IDS_DO_CATALOGO };
