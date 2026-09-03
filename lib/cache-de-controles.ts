/**
 * O CACHE DOS CONTROLES — leitura síncrona, sem banco e sem rede.
 *
 * Existe por uma razão de forma: `getMonthlyBudgetUsd`, `getLimiteGlobal` e os
 * limites de leitura são SÍNCRONOS e chamados em caminho quente (toda auditoria
 * passa por eles). Torná-los `async` para consultar o Postgres espalharia
 * `await` por meia dúzia de rotas e ainda somaria uma ida ao banco por
 * requisição.
 *
 * Então a leitura é daqui — memória do processo — e quem ENCHE esta memória é
 * [[configuracao-da-plataforma.ts]], que sim conhece o Prisma. É o mesmo
 * arranjo de `ai-model-config`, e é o que permite `ai-budget-policy.ts`
 * continuar honrando o que o cabeçalho dele promete.
 *
 * SEM CACHE, NADA QUEBRA: a escada cai para o ambiente e depois para o padrão,
 * que é exatamente como o sistema funcionava antes de o painel existir.
 */
import {
  definicaoDoControle,
  lerFreio,
  resolverControle,
  type ChaveDeControle,
  type ValorDoControle,
} from "@/lib/controles-da-plataforma";

/** A chave do freio do cadastro automático, que é texto e não número. */
export const CHAVE_DO_FREIO = "escritorio.padrao";

interface MemoriaDosControles {
  carregadoEm: number;
  /** Só as chaves que o banco declarou. Ausência aqui é ausência de linha. */
  numeros: Partial<Record<ChaveDeControle, number | null>>;
  /** `undefined` = o banco não declarou; `string` (inclusive "") = declarou. */
  freio: string | undefined;
}

const memoria = globalThis as typeof globalThis & {
  __nexodocControles?: MemoriaDosControles;
};

export function guardarControles(dados: Omit<MemoriaDosControles, "carregadoEm">) {
  memoria.__nexodocControles = { ...dados, carregadoEm: Date.now() };
}

export function memoriaDosControles() {
  return memoria.__nexodocControles;
}

export function esquecerControles() {
  memoria.__nexodocControles = undefined;
}

/** O valor efetivo de um controle, com a origem — banco, ambiente ou padrão. */
export function valorDoControle(chave: ChaveDeControle): ValorDoControle {
  const definicao = definicaoDoControle(chave);

  if (!definicao) return { valor: null, origem: "padrao" };

  return resolverControle(
    definicao,
    memoria.__nexodocControles?.numeros?.[chave],
    process.env[definicao.variavel],
  );
}

/** Atalho para quem só quer o número. */
export function numeroDoControle(chave: ChaveDeControle): number | null {
  return valorDoControle(chave).valor;
}

/**
 * O freio do cadastro automático, com a mesma escada.
 *
 * O `undefined` do banco tem que atravessar até `lerFreio` intacto: é ele que
 * distingue "não declarado" de "declarado como vazio", e essa distinção É o
 * freio. Um `?? ""` em qualquer ponto do caminho ligaria a exigência de convite
 * para todo mundo.
 */
export function freioDoCadastro() {
  const doBanco = memoria.__nexodocControles?.freio;
  const bruto = doBanco !== undefined ? doBanco : process.env.NEXODOC_ESCRITORIO_PADRAO;

  return {
    ...lerFreio(bruto),
    origem: doBanco !== undefined
      ? ("banco" as const)
      : process.env.NEXODOC_ESCRITORIO_PADRAO !== undefined
        ? ("ambiente" as const)
        : ("padrao" as const),
  };
}
