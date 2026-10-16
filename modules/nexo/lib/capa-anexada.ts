"use client";

/**
 * A CAPA EM PDF QUE O ENGENHEIRO ANEXOU (16/10/2026): entra no volume COMO
 * ESTÁ, no lugar da capa gerada pelo modelo. Uso único — vale para esta aba e
 * esta conversa, e não é gravada em lugar nenhum (PDF não vira modelo: tapar e
 * reescrever não bate fonte nem alinhamento numa peça que vai à prefeitura).
 *
 * Um estado externo, e não prop: quem anexa é o Workspace e quem gera é o card
 * da capa, que mora fundo na árvore do chat. Desenho:
 * docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 */
import { useSyncExternalStore } from "react";

export interface CapaAnexada {
  /** Id do anexo (o chip) — remover o chip tira a capa. */
  anexoId: string;
  arquivo: File;
}

let atual: CapaAnexada | null = null;
const ouvintes = new Set<() => void>();

export function definirCapaAnexada(capa: CapaAnexada | null) {
  if (capa === atual) return;
  atual = capa;
  ouvintes.forEach((f) => f());
}

/** Tira a capa SÓ se ela veio deste anexo. */
export function tirarCapaDoAnexo(anexoId: string) {
  if (atual?.anexoId === anexoId) definirCapaAnexada(null);
}

export function capaAnexadaAgora(): CapaAnexada | null {
  return atual;
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export function useCapaAnexada(): CapaAnexada | null {
  return useSyncExternalStore(assinar, capaAnexadaAgora, () => null);
}

/**
 * OS ODTs ANEXADOS que ainda não viraram modelo, por id do anexo. O card de
 * confirmação manda o ODT de novo no PUT — o servidor não guarda rascunho.
 * Só na memória da aba: depois do F5, o card pede o arquivo outra vez.
 */
const odtsPendentes = new Map<string, File>();

export function guardarOdtPendente(anexoId: string, arquivo: File) {
  odtsPendentes.set(anexoId, arquivo);
}

export function odtPendente(anexoId: string): File | null {
  return odtsPendentes.get(anexoId) ?? null;
}

export function esquecerOdtPendente(anexoId: string) {
  odtsPendentes.delete(anexoId);
}
