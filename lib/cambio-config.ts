/**
 * De onde vem a cotação em produção: banco primeiro, ambiente depois, nenhuma
 * por último. Mesma escada de `lib/escritorio-config.ts`, pelo mesmo motivo — a
 * máquina de desenvolvimento roda sem `DATABASE_URL`, e sem caminho pelo
 * ambiente a conversão seria impossível de exercitar fora de produção.
 */
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  COTACAO_NAO_DECLARADA,
  CotacaoDeclarada,
  cotacaoDeclarada,
  normalizarCotacao,
  validarCotacao,
} from "@/lib/cambio";

const ID_DA_LINHA = "cambio";
const CACHE_TTL_MS = 15_000;

const cambioStore = globalThis as typeof globalThis & {
  __nexodocCambio?: { loadedAt: number; cotacao: CotacaoDeclarada; origem: OrigemDaCotacao };
};

export type OrigemDaCotacao = "banco" | "ambiente" | "nenhuma";

function doAmbiente(): CotacaoDeclarada {
  const valor = process.env.NEXODOC_CAMBIO_USD_BRL;
  if (!valor) return COTACAO_NAO_DECLARADA;
  return normalizarCotacao({
    valor,
    // Sem data no ambiente, a data é a do boot. É honesto: o valor foi posto
    // ali por alguém, e a única coisa que sabemos é que vale desde agora.
    declaradaEm: new Date().toISOString(),
    declaradaPor: "ambiente",
  });
}

function guardar(cotacao: CotacaoDeclarada, origem: OrigemDaCotacao) {
  cambioStore.__nexodocCambio = { loadedAt: Date.now(), cotacao, origem };
  return cotacao;
}

/** NUNCA lança: sem cotação o painel fica em dólar, que é o estado anterior. */
export async function carregarCotacao(
  options: { force?: boolean } = {},
): Promise<CotacaoDeclarada> {
  const atual = cambioStore.__nexodocCambio;
  if (!options.force && atual && Date.now() - atual.loadedAt < CACHE_TTL_MS) {
    return atual.cotacao;
  }

  const ambiente = doAmbiente();
  const semBanco = () =>
    guardar(ambiente, cotacaoDeclarada(ambiente) ? "ambiente" : "nenhuma");

  if (!isDatabaseConfigured()) return semBanco();

  try {
    const linha = await getPrisma().cambioConfig.findUnique({ where: { id: ID_DA_LINHA } });
    if (!linha) return semBanco();

    const doBanco = normalizarCotacao({
      valor: linha.valor,
      declaradaEm: linha.declaradaEm.toISOString(),
      declaradaPor: linha.declaradaPor,
    });
    return cotacaoDeclarada(doBanco) ? guardar(doBanco, "banco") : semBanco();
  } catch (error) {
    console.warn("Não foi possível carregar a cotação do dólar.", error);
    return semBanco();
  }
}

export async function carregarCotacaoComOrigem(): Promise<{
  cotacao: CotacaoDeclarada;
  origem: OrigemDaCotacao;
  databaseConfigured: boolean;
}> {
  const cotacao = await carregarCotacao({ force: true });
  return {
    cotacao,
    origem: cambioStore.__nexodocCambio?.origem ?? "nenhuma",
    databaseConfigured: isDatabaseConfigured(),
  };
}

/**
 * Grava a cotação. A DATA É DE AGORA, sempre: o que a tela promete é "declarada
 * hoje", e aceitar uma data digitada abriria a porta para uma cotação velha
 * parecer nova.
 */
export async function salvarCotacao(args: {
  valor: unknown;
  declaradaPor?: string | null;
}): Promise<CotacaoDeclarada> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const cotacao = normalizarCotacao({
    valor: args.valor,
    declaradaEm: new Date().toISOString(),
    declaradaPor: args.declaradaPor ?? "admin",
  });
  const erros = validarCotacao(cotacao);
  if (erros.length > 0) throw new Error(erros.join(" "));

  const campos = {
    valor: cotacao.valor,
    declaradaEm: new Date(cotacao.declaradaEm),
    declaradaPor: cotacao.declaradaPor,
  };
  await getPrisma().cambioConfig.upsert({
    where: { id: ID_DA_LINHA },
    update: campos,
    create: { id: ID_DA_LINHA, ...campos },
  });

  cambioStore.__nexodocCambio = undefined;
  return carregarCotacao({ force: true });
}
