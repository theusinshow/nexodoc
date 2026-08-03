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
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import { gruposDasFolhas, type Folha } from "./folhas";
import { assinaturaDoTomo, folhasDoTomo, precisaRespeitarOrdem } from "./drop-folhas";
import {
  arquivosDaSeparatriz,
  postCapa,
  postLd,
  postSeparatriz,
  ODT_MIME,
} from "./generate";
import { summarizeSelos } from "./agent-context";
import { codigoDaFolha } from "./disciplina-da-folha";
import { totalDoConjunto } from "./totais";
import {
  CAMPOS_DA_IDENTIDADE,
  ROTULOS_DA_IDENTIDADE,
  type IdentidadeDoProjeto,
} from "./identidade";
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
  /** A identidade já corrigida à mão (vazio = tudo vem do carimbo). */
  identidade?: IdentidadeDoProjeto;
}): CampoEditavel[] {
  const p = args.params ?? {};
  const ident = args.identidade ?? {};
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
      /*
       * O ESCAPE de quando o carimbo mente. Estes seis não são decisão — são
       * fatos que o Nexo lê do selo e do nome do arquivo de propósito. Ficam
       * recolhidos porque o carimbo acerta quase sempre, e abertos empurrariam
       * para baixo os três campos que o engenheiro realmente confere.
       *
       * Valem para a CONVERSA, não para esta capa: a LD do mesmo volume imprime
       * a mesma obra e o mesmo código.
       */
      ...CAMPOS_DA_IDENTIDADE.map((chave) => ({
        chave,
        rotulo: ROTULOS_DA_IDENTIDADE[chave],
        valor: ident[chave] ?? "",
        grupo: "Identidade do projeto",
        ajudaDoGrupo:
          "Só preencha quando o carimbo estiver errado. Em branco, vale o que o " +
          "selo e o nome do arquivo dizem. O que você escrever aqui também sai na LD.",
        ...(chave === "obra" ? { linhas: 2 } : {}),
      })),
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
  /** Total de folhas por disciplina, corrigido à mão no canvas. */
  totais?: Record<string, number>;
  /** Identidade do projeto corrigida à mão (órgão, obra, código, revisão…). */
  identidade?: IdentidadeDoProjeto;
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
      identidade: args.identidade,
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
    // Regerar pelo editor do nó também tem de levar o total corrigido: senão a
    // mesma LD sairia numerada de um jeito pelo plano e de outro por aqui.
    const referenceTotal = totalDoConjunto(
      args.selos as Folha[],
      args.totais ?? {},
      codigoDaFolha,
    );
    const r = await postLd(args.selos, {
      tituloLd: args.valores.tituloLd,
      numTomos: num("numTomos", 1),
      tomoInicial: num("tomoInicial", 1),
      tomoAtual: tomo > 0 ? tomo - num("tomoInicial", 1) + 1 : 0,
      ...(referenceTotal ? { referenceTotal } : {}),
      identidade: args.identidade,
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

/* ------------------------------------------------------ Folhas do tomo ----- */

/**
 * O que a montagem precisa saber sobre UM tomo: quais folhas são dele, e as
 * opções que fazem o servidor respeitar essa decisão em vez de refazer a divisão
 * por quantidade.
 *
 * Fica aqui, e não no módulo puro, porque depende de `buildBalancedQuantities`
 * (import de runtime). Existe num lugar só porque são DOIS caminhos de geração —
 * o plano e o card avulso — e um deles ficar para trás é exatamente como o PDF
 * volta a discordar do canvas.
 */
export function opcoesDoTomo(
  selos: SeloForLd[],
  numTomos: number,
  tomoAtual: number,
): {
  doTomo: Folha[];
  opts: { folhasDoTomo?: string[]; respeitarOrdem?: boolean };
} {
  if (tomoAtual <= 0) return { doTomo: [], opts: {} };
  const projecao = selos as Folha[];
  const divisao = gruposDasFolhas(projecao, numTomos, buildBalancedQuantities);
  const doTomo = folhasDoTomo(projecao, divisao, tomoAtual);
  if (doTomo.length === 0) return { doTomo, opts: {} };
  return {
    doTomo,
    opts: {
      folhasDoTomo: doTomo.map((f) => f.id),
      // O carimbo continua mandando na ordem, salvo se o usuário reordenou
      // alguma folha DESTE tomo.
      respeitarOrdem: precisaRespeitarOrdem(doTomo),
    },
  };
}

/* ------------------------------------------------- Geração em conjunto ----- */

/** Um documento a gerar: o tipo, o tomo a que pertence e os params. */
export interface ItemDoPlano {
  kind: "capa" | "ld" | "separatriz";
  /** 0 = documento único (sem divisão em tomos). */
  tomoAtual: number;
  tomoNumero: number;
  sufixo: string;
  params: Record<string, unknown>;
  /** Rótulo curto para a barra de progresso ("Capa · TOMO 02"). */
  rotulo: string;
  /**
   * O BLOCO (disciplina) deste documento, quando o volume mistura disciplinas.
   *
   * Ausente = o volume é de uma disciplina só, e o documento cobre tudo — o
   * comportamento de sempre. Presente, a LD sai com o título e as folhas
   * daquela disciplina, e a separatriz com o nome dela: é a regra do
   * escritório, que emite uma de cada por disciplina dentro do volume.
   */
  bloco?: { codigo: string; rotulo: string; ids: string[] };
}

/**
 * Gera UM item do plano.
 *
 * A separatriz recebe o título PRONTO (o da capa do mesmo tomo) em vez de
 * derivá-lo: derivar em dois lugares é como ela voltou a poder discordar da capa
 * antes.
 */
export async function gerarItem(args: {
  item: ItemDoPlano;
  selos: SeloForLd[];
  saveResult: (input: SaveResultInput) => Promise<void>;
  /** Ids base (sem sufixo de tomo) dos três tipos. */
  idsBase: { capa: string; ld: string; separatriz: string };
  tituloDaSeparatriz: string;
  /** Total de folhas por disciplina, corrigido à mão no canvas. */
  totais?: Record<string, number>;
  /** Identidade do projeto corrigida à mão (órgão, obra, código, revisão…). */
  identidade?: IdentidadeDoProjeto;
}): Promise<void> {
  const { item, selos, saveResult } = args;
  const p = item.params;
  const num = (k: string, padrao: number) =>
    typeof p[k] === "number" ? (p[k] as number) : padrao;
  const txt = (k: string) => String(p[k] ?? "");

  if (item.kind === "capa") {
    const r = await postCapa(selos, {
      templateId: txt("templateId"),
      tituloCapa: txt("tituloCapa"),
      volume: txt("volume"),
      // Este card É um tomo: gera UMA capa, a daquele tomo.
      numTomos: item.tomoAtual > 0 ? 1 : num("numTomos", 1),
      tomoInicial: num("tomoInicial", 1),
      tomoNumero: item.tomoAtual > 0 ? item.tomoNumero : 0,
      identidade: args.identidade,
    });
    await saveResult({
      artifactId: args.idsBase.capa + item.sufixo,
      kind: "capa",
      payload: { ...p, tomo: item.tomoNumero },
      summary: `Capa ${r.resumo.prefeitura} · ${r.resumo.codigo} · vol ${r.resumo.volume}`,
      canvas: {
        label: `Capa ${r.resumo.prefeitura}`,
        detail: `${r.resumo.codigo} · vol ${r.resumo.volume}`,
        titulo: txt("tituloCapa"),
        pageNumber: 1,
      },
      files: [
        { label: "ZIP", name: r.zipName, mime: "application/zip", url: r.zipUrl, primary: true },
        { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
        ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
      ],
    });
    return;
  }

  if (item.kind === "ld") {
    /*
     * A divisão do tomo sai do CANVAS, não da contagem: `gruposDasFolhas`
     * respeita o `grupo` arrastado à mão, e `faixasDosTomos` (que o servidor
     * usava) o ignorava — o PDF saía com uma organização diferente da tela.
     *
     * Os selos vão INTEIROS mesmo assim: o total de referência do carimbo
     * ("05/24") é contado sobre o conjunto, e mandar só a fatia viraria "05/12".
     */
    const { doTomo, opts } = opcoesDoTomo(selos, num("numTomos", 1), item.tomoAtual);
    /*
     * Com bloco, as folhas são as DELE — recortadas dentro do tomo quando há
     * os dois. O título vira o da disciplina: é ele que sai impresso no
     * cabeçalho da LD e tem de casar com a separatriz que abre o bloco.
     */
    const doBloco = item.bloco
      ? doTomo.length > 0
        ? doTomo.filter((f) => item.bloco!.ids.includes(f.id))
        : (selos as Folha[]).filter((f) => item.bloco!.ids.includes(f.id))
      : doTomo;
    const titulo = item.bloco?.rotulo.toUpperCase() || txt("tituloLd");
    /*
     * O total corrigido à mão, das folhas que ESTA LD lista — o bloco quando há
     * um, senão o tomo, senão tudo. Sem isto o plano em lote (o caminho normal
     * de gerar) numeraria pelo carimbo mal lido, enquanto o card avulso e a
     * conferência já usariam o número corrigido.
     */
    const referenceTotal = totalDoConjunto(
      doBloco.length > 0 ? doBloco : (selos as Folha[]),
      args.totais ?? {},
      codigoDaFolha,
    );
    const r = await postLd(selos, {
      tituloLd: titulo,
      numTomos: num("numTomos", 1),
      tomoInicial: num("tomoInicial", 1),
      tomoAtual: item.tomoAtual,
      ...(referenceTotal ? { referenceTotal } : {}),
      identidade: args.identidade,
      ...opts,
      ...(item.bloco
        ? { folhasDoTomo: doBloco.map((f) => f.id), respeitarOrdem: true }
        : {}),
    });
    await saveResult({
      artifactId: args.idsBase.ld + item.sufixo,
      kind: "ld",
      /*
       * A assinatura das folhas entra no payload: é comparando-a com a projeção
       * atual que o nó descobre que envelheceu. Sem ela, arrastar uma folha (ou
       * corrigir um título) deixaria esta LD descrevendo um conjunto que não
       * existe mais, sem nada na tela avisando.
       */
      payload: {
        ...p,
        ...(item.bloco ? { tituloLd: titulo, bloco: item.bloco.codigo } : {}),
        tomo: item.tomoNumero,
        folhas: assinaturaDoTomo(doBloco),
      },
      summary: `LD ${r.resumo.disciplina} · ${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
      canvas: {
        label: `LD ${r.resumo.disciplina}`,
        detail: `${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
        titulo: txt("tituloLd"),
        pageNumber: 1,
      },
      files: [
        { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
        ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
      ],
    });
    return;
  }

  /*
   * SEPARATRIZ. Três origens para o título, nesta ordem:
   *
   * 1. a LISTA que o engenheiro ditou na conversa ("as separatrizes de elétrica,
   *    CFTV e SPDA") — um documento com uma folha por item. Ela manda porque ali
   *    ele não está nomeando a capa desta conversa: está pedindo as folhas de
   *    rosto do volume inteiro, inclusive de disciplinas que não estão anexadas.
   *    Era o último uso que ainda obrigava a abrir a tela `/separatrizes`, e o
   *    plano em lote — o caminho normal de gerar — a ignorava, pedindo um título
   *    que já tinha sido dado;
   * 2. o bloco, num volume misto: a folha nomeia a DISCIPLINA;
   * 3. a capa, no caso comum de um volume, uma disciplina.
   */
  const listados = Array.isArray(p.titulos)
    ? (p.titulos as unknown[]).map((t) => String(t ?? "").trim()).filter(Boolean)
    : [];
  const tituloSep = item.bloco?.rotulo.toUpperCase() || args.tituloDaSeparatriz.trim();
  const titulos = listados.length > 0 ? listados : tituloSep ? [tituloSep] : [];
  if (titulos.length === 0) return; // sem título não há separatriz — a capa manda nela
  const ident = summarizeSelos(selos);
  const sep = await postSeparatriz(titulos, {
    // O código corrigido à mão manda no nome do arquivo, como na capa e na LD.
    codigo: args.identidade?.codigo ?? ident.codigo ?? "",
    revisao: args.identidade?.revisao ?? ident.revisao ?? "",
  });
  const quantas = titulos.length > 1 ? ` · ${titulos.length} folhas` : "";
  await saveResult({
    artifactId: args.idsBase.separatriz + item.sufixo,
    kind: "separatriz",
    payload: {
      titulo: titulos[0],
      tomo: item.tomoNumero,
      // Só com mais de uma: a chave a mais faria toda separatriz já gerada
      // parecer desatualizada (o estado do card compara o payload literalmente).
      ...(titulos.length > 1 ? { titulos } : {}),
      ...(item.bloco ? { bloco: item.bloco.codigo } : {}),
    },
    summary: `Separatriz ${titulos[0]}${quantas}`,
    canvas: { label: "Separatriz", titulo: titulos.join(" · "), pageNumber: 1 },
    files: arquivosDaSeparatriz(sep),
  });
}
