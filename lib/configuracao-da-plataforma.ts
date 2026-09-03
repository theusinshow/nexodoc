/**
 * OS CONTROLES, do banco — quem enche o cache de [[cache-de-controles.ts]].
 *
 * Escada `banco → ambiente → constante`, a mesma de `cambio-config` e
 * `meta-qualidade-config`. Uma tabela chave/valor para os oito números e o
 * freio, e não uma tabela por controle: são todos "um número com piso e teto", e
 * repetir o padrão criaria quatro migrações e quatro lugares para esquecer a
 * escada.
 */
import {
  CHAVE_DO_FREIO,
  esquecerControles,
  freioDoCadastro,
  guardarControles,
  memoriaDosControles,
  valorDoControle,
} from "@/lib/cache-de-controles";
import {
  CONTROLES,
  definicaoDoControle,
  validarValorDoControle,
  type ChaveDeControle,
} from "@/lib/controles-da-plataforma";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

const CACHE_TTL_MS = 15_000;

/**
 * Recarrega o cache. NUNCA lança: sem banco (ou com ele fora do ar) a escada
 * cai para o ambiente, que é como o sistema funcionava antes do painel.
 */
export async function recarregarControles(opcoes: { force?: boolean } = {}) {
  const atual = memoriaDosControles();

  if (!opcoes.force && atual && Date.now() - atual.carregadoEm < CACHE_TTL_MS) {
    return;
  }

  if (!isDatabaseConfigured()) {
    guardarControles({ numeros: {}, freio: undefined });
    return;
  }

  try {
    const linhas = await getPrisma().configuracaoDaPlataforma.findMany();
    const numeros: Partial<Record<ChaveDeControle, number | null>> = {};
    let freio: string | undefined;

    for (const linha of linhas) {
      if (linha.chave === CHAVE_DO_FREIO) {
        freio = typeof linha.valor === "string" ? linha.valor : "";
        continue;
      }

      if (!definicaoDoControle(linha.chave)) continue;

      /*
       * `null` gravado é DECISÃO ("não quero teto") e precisa chegar ao cache
       * como `null`, não sumir. Sumir o devolveria à variável de ambiente, e
       * desligar um teto pela tela seria impossível.
       */
      numeros[linha.chave as ChaveDeControle] =
        typeof linha.valor === "number" ? linha.valor : null;
    }

    guardarControles({ numeros, freio });
  } catch (erro) {
    console.warn("[controles] não foi possível carregar do banco; valendo ambiente.", erro);
    guardarControles({ numeros: {}, freio: undefined });
  }
}

/** O retrato que o painel desenha: valor efetivo, origem e a faixa aceita. */
export async function lerControlesParaOPainel() {
  await recarregarControles({ force: true });

  return {
    databaseConfigured: isDatabaseConfigured(),
    controles: CONTROLES.map((definicao) => {
      const { valor, origem } = valorDoControle(definicao.chave);

      return {
        chave: definicao.chave,
        rotulo: definicao.rotulo,
        descricao: definicao.descricao,
        variavel: definicao.variavel,
        minimo: definicao.minimo,
        maximo: definicao.maximo,
        unidade: definicao.unidade,
        padrao: definicao.padrao,
        valor,
        origem,
      };
    }),
    freio: freioDoCadastro(),
  };
}

export async function salvarControle(chave: string, bruto: unknown, quem: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada; não é possível salvar controles.");
  }

  const veredito = validarValorDoControle(chave, bruto);

  if (!veredito.ok) throw new Error(veredito.motivo);

  const campos = { valor: veredito.valor as never, declaradaPor: quem };

  await getPrisma().configuracaoDaPlataforma.upsert({
    where: { chave },
    update: campos,
    create: { chave, ...campos },
  });

  esquecerControles();
  await recarregarControles({ force: true });

  return veredito.valor;
}

/**
 * Volta ao que o ambiente (ou o código) manda — apagando a linha, e não
 * gravando o valor atual.
 *
 * A diferença importa: gravar o valor congelaria no banco o que hoje vem da
 * variável, e mudar a variável depois não teria efeito nenhum. Ninguém
 * entenderia por quê.
 */
export async function esquecerControle(chave: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  await getPrisma().configuracaoDaPlataforma.deleteMany({ where: { chave } });
  esquecerControles();
  await recarregarControles({ force: true });
}

export async function salvarFreio(valor: string | null, quem: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  if (valor === null) {
    // `null` aqui é "volte ao ambiente" — a mesma semântica de `esquecerControle`.
    await esquecerControle(CHAVE_DO_FREIO);
    return;
  }

  const campos = { valor: valor as never, declaradaPor: quem };

  await getPrisma().configuracaoDaPlataforma.upsert({
    where: { chave: CHAVE_DO_FREIO },
    update: campos,
    create: { chave: CHAVE_DO_FREIO, ...campos },
  });

  esquecerControles();
  await recarregarControles({ force: true });
}
