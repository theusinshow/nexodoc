"use client";

/**
 * OS TRÊS EDITÁVEIS DA ENTREGA: uma capa, uma LD, uma separatriz.
 *
 * A montagem gera um documento POR TOMO, porque cada volume físico precisa da
 * sua capa dentro dele. Para ENTREGAR é o oposto: num projeto de seis tomos, o
 * escritório recebia vinte ODTs soltos para abrir um a um no LibreOffice.
 *
 * Os três modos consolidados já existiam e nunca eram usados — a capa aceita
 * `numTomos: N` e devolve um documento com N páginas; a LD aceita
 * `tomoAtual: 0` e devolve um só com os tomos como seções; a separatriz sempre
 * nasceu com uma página por título. O que faltava era chamá-los assim.
 *
 * NÃO substitui os por-tomo: aqueles são o que entra dentro de cada volume, e
 * continuam sendo gerados pelo plano. Estes são a via de EDIÇÃO.
 */

import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { SavedResult } from "../state/conversation-store";
import type { IdentidadeDoProjeto } from "./identidade";
import { postCapa, postLd, postSeparatriz } from "./generate";
import type { Editavel } from "./editaveis";

/** O que os cards já gerados dizem sobre como este volume foi montado. */
export interface ParametrosDaEntrega {
  templateId: string;
  tituloCapa: string;
  tituloLd: string;
  volume: string;
  numTomos: number;
  tomoInicial: number;
  mes: string;
  ano: string;
  titulosDaSeparatriz: string[];
}

/** Lê o `payload` do primeiro card de cada tipo — a decisão que gerou o volume. */
export function parametrosDaEntrega(results: readonly SavedResult[]): ParametrosDaEntrega {
  const p = (kind: string) =>
    (results.find((r) => r.kind === kind)?.payload ?? {}) as Record<string, unknown>;
  const capa = p("capa");
  const ld = p("ld");
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const numero = (v: unknown, padrao: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.trunc(v) : padrao;

  /*
   * Os títulos da separatriz: um por BLOCO quando o volume é misto, senão o
   * título do card. `Set` porque os cards se repetem por tomo e a separatriz
   * consolidada tem UMA folha por disciplina, não uma por tomo.
   */
  const titulos = [
    ...new Set(
      results
        .filter((r) => r.kind === "separatriz")
        .map((r) => texto((r.payload as Record<string, unknown>)?.titulo))
        .filter(Boolean),
    ),
  ];

  return {
    templateId: texto(capa.templateId),
    tituloCapa: texto(capa.tituloCapa),
    tituloLd: texto(ld.tituloLd) || texto(capa.tituloCapa),
    volume: texto(capa.volume),
    numTomos: numero(capa.numTomos ?? ld.numTomos, 1),
    tomoInicial: numero(capa.tomoInicial ?? ld.tomoInicial, 1),
    mes: texto(capa.mes),
    ano: texto(capa.ano),
    titulosDaSeparatriz: titulos,
  };
}

/**
 * Gera os três consolidados e devolve-os como editáveis prontos para o ZIP.
 *
 * Cada um é tentado por si: uma capa que falha não pode levar junto a LD, que é
 * o documento mais caro de refazer à mão. O que falhar simplesmente não entra —
 * e quem chama conta quantos vieram.
 */
export async function gerarEditaveisConsolidados(args: {
  selos: SeloForLd[];
  params: ParametrosDaEntrega;
  identidade?: IdentidadeDoProjeto;
  referenceTotal?: number;
}): Promise<{ editaveis: Editavel[]; falhas: string[] }> {
  const { selos, params, identidade } = args;
  const editaveis: Editavel[] = [];
  const falhas: string[] = [];

  if (params.templateId) {
    try {
      const r = await postCapa(selos, {
        templateId: params.templateId,
        tituloCapa: params.tituloCapa,
        volume: params.volume,
        // `tomoNumero: 0` + `numTomos: N` = UM documento com N páginas, uma por
        // tomo. É o modo que a montagem nunca usa e a entrega sempre quis.
        numTomos: params.numTomos,
        tomoInicial: params.tomoInicial,
        tomoNumero: 0,
        mes: params.mes,
        ano: params.ano,
        identidade,
      });
      editaveis.push({ nome: `capa--${r.odtName}`, url: r.odtUrl });
    } catch (err) {
      falhas.push(`capa (${err instanceof Error ? err.message : "erro"})`);
    }
  }

  try {
    const r = await postLd(selos, {
      tituloLd: params.tituloLd,
      numTomos: params.numTomos,
      tomoInicial: params.tomoInicial,
      // `tomoAtual: 0` = documento ÚNICO com os tomos como seções.
      tomoAtual: 0,
      ...(args.referenceTotal ? { referenceTotal: args.referenceTotal } : {}),
      identidade,
    });
    editaveis.push({ nome: `ld--${r.odtName}`, url: r.odtUrl });
  } catch (err) {
    falhas.push(`LD (${err instanceof Error ? err.message : "erro"})`);
  }

  if (params.titulosDaSeparatriz.length > 0) {
    try {
      const r = await postSeparatriz(params.titulosDaSeparatriz, {
        codigo: identidade?.codigo,
        revisao: identidade?.revisao,
      });
      editaveis.push({ nome: `separatriz--${r.odt.name}`, url: r.odt.url });
    } catch (err) {
      falhas.push(`separatriz (${err instanceof Error ? err.message : "erro"})`);
    }
  }

  return { editaveis, falhas };
}
