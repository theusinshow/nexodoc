/**
 * De onde vêm as metas de qualidade: banco primeiro, ambiente depois, nenhuma
 * por último. Terceira escada igual (`escritorio-config`, `cambio-config`) — e
 * a repetição é consciente: são três dados de natureza diferente, com validação
 * própria, e uma tabela chave/valor genérica trocaria três colunas tipadas por
 * um `JSON` que ninguém consegue migrar depois.
 */
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  METAS_NAO_DECLARADAS,
  MetasDeQualidade,
  normalizarMetas,
  validarMetas,
} from "@/lib/meta-de-qualidade";

const ID_DA_LINHA = "meta-qualidade";
const CACHE_TTL_MS = 15_000;

const metaStore = globalThis as typeof globalThis & {
  __nexodocMetaQualidade?: { loadedAt: number; metas: MetasDeQualidade; origem: OrigemDaMeta };
};

export type OrigemDaMeta = "banco" | "ambiente" | "nenhuma";

function declarada(metas: MetasDeQualidade): boolean {
  return metas.falsoPositivoMax > 0 || metas.coberturaMin > 0;
}

function doAmbiente(): MetasDeQualidade {
  return normalizarMetas({
    falsoPositivoMax: process.env.NEXODOC_META_FALSO_POSITIVO,
    coberturaMin: process.env.NEXODOC_META_COBERTURA,
    declaradaEm: new Date().toISOString(),
    declaradaPor: "ambiente",
  });
}

function guardar(metas: MetasDeQualidade, origem: OrigemDaMeta) {
  metaStore.__nexodocMetaQualidade = { loadedAt: Date.now(), metas, origem };
  return metas;
}

/** NUNCA lança: sem metas o painel mostra os números sem julgá-los. */
export async function carregarMetas(
  options: { force?: boolean } = {},
): Promise<MetasDeQualidade> {
  const atual = metaStore.__nexodocMetaQualidade;
  if (!options.force && atual && Date.now() - atual.loadedAt < CACHE_TTL_MS) {
    return atual.metas;
  }

  const ambiente = doAmbiente();
  const semBanco = () => guardar(ambiente, declarada(ambiente) ? "ambiente" : "nenhuma");

  if (!isDatabaseConfigured()) return semBanco();

  try {
    const linha = await getPrisma().metaQualidadeConfig.findUnique({ where: { id: ID_DA_LINHA } });
    if (!linha) return semBanco();

    const doBanco = normalizarMetas({
      falsoPositivoMax: linha.falsoPositivoMax,
      coberturaMin: linha.coberturaMin,
      declaradaEm: linha.declaradaEm.toISOString(),
      declaradaPor: linha.declaradaPor,
    });
    return declarada(doBanco) ? guardar(doBanco, "banco") : semBanco();
  } catch (error) {
    console.warn("Não foi possível carregar as metas de qualidade.", error);
    return semBanco();
  }
}

export async function carregarMetasComOrigem(): Promise<{
  metas: MetasDeQualidade;
  origem: OrigemDaMeta;
  databaseConfigured: boolean;
}> {
  const metas = await carregarMetas({ force: true });
  return {
    metas,
    origem: metaStore.__nexodocMetaQualidade?.origem ?? "nenhuma",
    databaseConfigured: isDatabaseConfigured(),
  };
}

export async function salvarMetas(args: {
  metas: unknown;
  declaradaPor?: string | null;
}): Promise<MetasDeQualidade> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const bruto = (args.metas ?? {}) as Record<string, unknown>;
  const metas = normalizarMetas({
    ...bruto,
    declaradaEm: new Date().toISOString(),
    declaradaPor: args.declaradaPor ?? "admin",
  });
  const erros = validarMetas(metas);
  if (erros.length > 0) throw new Error(erros.join(" "));

  const campos = {
    falsoPositivoMax: metas.falsoPositivoMax,
    coberturaMin: metas.coberturaMin,
    declaradaEm: new Date(metas.declaradaEm),
    declaradaPor: metas.declaradaPor,
  };
  await getPrisma().metaQualidadeConfig.upsert({
    where: { id: ID_DA_LINHA },
    update: campos,
    create: { id: ID_DA_LINHA, ...campos },
  });

  metaStore.__nexodocMetaQualidade = undefined;
  return carregarMetas({ force: true });
}

export { METAS_NAO_DECLARADAS };
