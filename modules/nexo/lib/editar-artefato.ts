"use client";

/**
 * Cola entre o editor do nó e a geração: quais campos cada tipo de documento
 * oferece, e o que acontece ao aplicar.
 *
 * Fica FORA do componente do canvas porque é a parte com regra de negócio — o
 * nó só desenha. Em especial a regra do nº de tomos, que é a única alteração
 * que NÃO regenera nada.
 */

import type { CampoEditavel } from "../components/EditorDoNo";
import type { NexoArtifactKind } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { postCapa, postLd, ODT_MIME } from "./generate";
import { orfaosAposDivisao } from "./edicao";
import { tomoDoArtefato } from "./results";
import type { SaveResultInput, SavedResult } from "../state/conversation-store";

const PDF_MIME = "application/pdf";

/** Campos do editor para um artefato, a partir dos params que o originaram. */
export function camposDoArtefato(args: {
  kind: NexoArtifactKind;
  params: Record<string, unknown> | undefined;
  /** Prefeituras configuradas (lista fechada do campo da capa). */
  templates: { id: string; nome: string }[];
  /** Tomos dos artefatos já gerados — base do aviso de órfãos. */
  tomosExistentes: number[];
}): CampoEditavel[] {
  const p = args.params ?? {};
  const txt = (k: string) => String(p[k] ?? "");
  const num = (k: string, padrao: number) =>
    String(typeof p[k] === "number" ? p[k] : padrao);

  /*
   * Mudar a divisão em tomos RECRIA a identidade de todos os artefatos (o tomo
   * vive no id), então os documentos já gerados viram resto. O aviso diz quantos
   * antes de aplicar — trocar isso sem saber o custo é caro.
   */
  const avisoTomos =
    (chave: "numTomos" | "tomoInicial") => (valor: string) => {
      const n = Number(valor);
      if (!Number.isFinite(n) || n < 1) return null;
      const numTomos = chave === "numTomos" ? n : Number(num("numTomos", 1));
      const inicial = chave === "tomoInicial" ? n : Number(num("tomoInicial", 1));
      const orfaos = orfaosAposDivisao(args.tomosExistentes, numTomos, inicial);
      if (orfaos === 0) return null;
      return `${orfaos} documento${orfaos > 1 ? "s" : ""} já gerado${
        orfaos > 1 ? "s" : ""
      } sai${orfaos > 1 ? "em" : ""} da divisão. Nada é regerado agora — os cards novos aparecem na conversa.`;
    };

  if (args.kind === "capa") {
    return [
      { chave: "tituloCapa", rotulo: "Título", valor: txt("tituloCapa"), linhas: 3 },
      {
        chave: "templateId",
        rotulo: "Prefeitura",
        valor: txt("templateId"),
        opcoes: args.templates.map((t) => ({ valor: t.id, rotulo: t.nome })),
      },
      { chave: "volume", rotulo: "Volume", valor: txt("volume") },
      {
        chave: "numTomos",
        rotulo: "Nº de tomos",
        valor: num("numTomos", 1),
        avisoAoMudar: avisoTomos("numTomos"),
      },
      {
        chave: "tomoInicial",
        rotulo: "Tomo inicial",
        valor: num("tomoInicial", 1),
        avisoAoMudar: avisoTomos("tomoInicial"),
      },
      { chave: "mes", rotulo: "Mês", valor: txt("mes") },
      { chave: "ano", rotulo: "Ano", valor: txt("ano") },
    ];
  }

  if (args.kind === "ld") {
    return [
      { chave: "tituloLd", rotulo: "Título", valor: txt("tituloLd"), linhas: 3 },
      {
        chave: "numTomos",
        rotulo: "Nº de tomos",
        valor: num("numTomos", 1),
        avisoAoMudar: avisoTomos("numTomos"),
      },
      {
        chave: "tomoInicial",
        rotulo: "Tomo inicial",
        valor: num("tomoInicial", 1),
        avisoAoMudar: avisoTomos("tomoInicial"),
      },
    ];
  }

  if (args.kind === "separatriz") {
    // Herda o título da capa: editar aqui recriaria a divergência que a herança
    // resolveu (folha de rosto dizendo uma coisa, capa outra, no mesmo tomo).
    return [
      {
        chave: "titulo",
        rotulo: "Título (vem da capa)",
        valor: txt("titulo"),
        somenteLeitura: true,
      },
    ];
  }

  return [];
}

/** Mexer nisto muda a IDENTIDADE dos artefatos, não só o conteúdo. */
function mudouADivisao(
  antes: Record<string, unknown> | undefined,
  novos: Record<string, string>,
): boolean {
  const p = antes ?? {};
  for (const k of ["numTomos", "tomoInicial"]) {
    if (novos[k] === undefined) continue;
    const de = String(typeof p[k] === "number" ? p[k] : 1);
    if (de !== novos[k]) return true;
  }
  return false;
}

/**
 * Aplica a edição de um nó. Regenera o documento com os valores novos, EXCETO
 * quando a divisão em tomos mudou — aí só a decisão é registrada, porque
 * regerar N documentos por uma tecla apertada sem querer é caro e demorado.
 *
 * Devolve `true` se regenerou.
 */
export async function aplicarEdicaoNoNo(args: {
  kind: NexoArtifactKind;
  artifactId: string;
  valores: Record<string, string>;
  paramsAntigos: Record<string, unknown> | undefined;
  selos: SeloForLd[];
  saveResult: (input: SaveResultInput) => Promise<void>;
}): Promise<boolean> {
  if (mudouADivisao(args.paramsAntigos, args.valores)) return false;

  const p = args.paramsAntigos ?? {};
  const tomo = tomoDoArtefato(args.artifactId);
  const num = (k: string, padrao: number) => {
    const v = Number(args.valores[k]);
    return Number.isFinite(v) && v >= 1
      ? Math.floor(v)
      : typeof p[k] === "number"
        ? (p[k] as number)
        : padrao;
  };

  if (args.kind === "capa") {
    const r = await postCapa(args.selos, {
      templateId: args.valores.templateId ?? String(p.templateId ?? ""),
      tituloCapa: args.valores.tituloCapa,
      volume: args.valores.volume,
      numTomos: tomo > 0 ? 1 : num("numTomos", 1),
      tomoInicial: num("tomoInicial", 1),
      tomoNumero: tomo > 0 ? tomo : 0,
      mes: args.valores.mes,
      ano: args.valores.ano,
    });
    await args.saveResult({
      artifactId: args.artifactId,
      kind: "capa",
      payload: { ...p, ...args.valores, numTomos: num("numTomos", 1), tomoInicial: num("tomoInicial", 1) },
      summary: `Capa ${r.resumo.prefeitura} · ${r.resumo.codigo} · vol ${r.resumo.volume}`,
      canvas: {
        label: `Capa ${r.resumo.prefeitura}`,
        detail: `${r.resumo.codigo} · vol ${r.resumo.volume}`,
        titulo: args.valores.tituloCapa,
        pageNumber: 1,
      },
      files: [
        { label: "ZIP", name: r.zipName, mime: "application/zip", url: r.zipUrl, primary: true },
        { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
        ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
      ],
    });
    return true;
  }

  if (args.kind === "ld") {
    const r = await postLd(args.selos, {
      tituloLd: args.valores.tituloLd,
      numTomos: num("numTomos", 1),
      tomoInicial: num("tomoInicial", 1),
      tomoAtual: tomo > 0 ? tomo - num("tomoInicial", 1) + 1 : 0,
    });
    await args.saveResult({
      artifactId: args.artifactId,
      kind: "ld",
      payload: { ...p, ...args.valores, numTomos: num("numTomos", 1), tomoInicial: num("tomoInicial", 1) },
      summary: `LD ${r.resumo.disciplina} · ${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
      canvas: {
        label: `LD ${r.resumo.disciplina}`,
        detail: `${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
        titulo: args.valores.tituloLd,
        pageNumber: 1,
      },
      files: [
        { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
        ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
      ],
    });
    return true;
  }

  return false;
}

/** Só para o tipo do `results` não vazar para o componente. */
export type { SavedResult };
