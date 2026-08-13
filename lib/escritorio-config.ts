/**
 * De onde vêm os DADOS DO ESCRITÓRIO em produção: banco primeiro, ambiente
 * depois, vazio por último.
 *
 * O `.env` existe porque a máquina de desenvolvimento roda sem `DATABASE_URL` — e
 * sem um caminho sem banco, a regra que este dado alimenta (a subtração do
 * endereço do emissor, em `lib/escritorio.ts`) seria impossível de exercitar
 * fora de produção.
 *
 * Precedência: banco > ambiente > vazio. O banco vence porque é o que o admin
 * edita; o ambiente é semente, não trava.
 */
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  DadosDoEscritorio,
  ESCRITORIO_VAZIO,
  escritorioDeclarado,
  normalizarDadosDoEscritorio,
  validarDadosDoEscritorio,
} from "@/lib/escritorio";

const ID_DA_LINHA = "escritorio";
const CACHE_TTL_MS = 15_000;

const escritorioStore = globalThis as typeof globalThis & {
  __nexodocEscritorio?: { loadedAt: number; dados: DadosDoEscritorio; origem: OrigemDoEscritorio };
};

export type OrigemDoEscritorio = "banco" | "ambiente" | "nenhuma";

function doAmbiente(): DadosDoEscritorio {
  return normalizarDadosDoEscritorio({
    nome: process.env.NEXODOC_ESCRITORIO_NOME,
    enderecoImpresso: process.env.NEXODOC_ESCRITORIO_ENDERECO,
    municipio: process.env.NEXODOC_ESCRITORIO_MUNICIPIO,
    uf: process.env.NEXODOC_ESCRITORIO_UF,
    responsavelTecnico: process.env.NEXODOC_ESCRITORIO_RESPONSAVEL,
    crea: process.env.NEXODOC_ESCRITORIO_CREA,
  });
}

function guardarNoCache(dados: DadosDoEscritorio, origem: OrigemDoEscritorio) {
  escritorioStore.__nexodocEscritorio = { loadedAt: Date.now(), dados, origem };
  return dados;
}

/**
 * O escritório declarado. NUNCA lança: uma falha de banco aqui não pode derrubar
 * a geração de um volume — ela só devolve o sistema ao comportamento de antes,
 * que é não saber o próprio endereço.
 */
export async function carregarEscritorio(
  options: { force?: boolean } = {},
): Promise<DadosDoEscritorio> {
  const atual = escritorioStore.__nexodocEscritorio;
  if (!options.force && atual && Date.now() - atual.loadedAt < CACHE_TTL_MS) {
    return atual.dados;
  }

  const ambiente = doAmbiente();

  if (!isDatabaseConfigured()) {
    return guardarNoCache(ambiente, escritorioDeclarado(ambiente) ? "ambiente" : "nenhuma");
  }

  try {
    const linha = await getPrisma().escritorioConfig.findUnique({ where: { id: ID_DA_LINHA } });
    if (!linha) {
      return guardarNoCache(ambiente, escritorioDeclarado(ambiente) ? "ambiente" : "nenhuma");
    }

    const doBanco = normalizarDadosDoEscritorio(linha);
    return escritorioDeclarado(doBanco)
      ? guardarNoCache(doBanco, "banco")
      : guardarNoCache(ambiente, escritorioDeclarado(ambiente) ? "ambiente" : "nenhuma");
  } catch (error) {
    console.warn("Não foi possível carregar os dados do escritório.", error);
    return guardarNoCache(ambiente, escritorioDeclarado(ambiente) ? "ambiente" : "nenhuma");
  }
}

/** O que a tela do admin mostra junto dos campos: de onde o valor veio. */
export async function carregarEscritorioComOrigem(): Promise<{
  dados: DadosDoEscritorio;
  origem: OrigemDoEscritorio;
  databaseConfigured: boolean;
}> {
  const dados = await carregarEscritorio({ force: true });
  return {
    dados,
    origem: escritorioStore.__nexodocEscritorio?.origem ?? "nenhuma",
    databaseConfigured: isDatabaseConfigured(),
  };
}

/** Sem banco não há gravação — e dizer isso é melhor que salvar no vazio. */
export async function salvarEscritorio(args: {
  dados: unknown;
  updatedBy?: string | null;
}): Promise<DadosDoEscritorio> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const dados = normalizarDadosDoEscritorio(args.dados);
  const erros = validarDadosDoEscritorio(dados);
  if (erros.length > 0) {
    throw new Error(erros.join(" "));
  }

  const campos = { ...dados, updatedBy: args.updatedBy ?? null };
  await getPrisma().escritorioConfig.upsert({
    where: { id: ID_DA_LINHA },
    update: campos,
    create: { id: ID_DA_LINHA, ...campos },
  });

  escritorioStore.__nexodocEscritorio = undefined;
  return carregarEscritorio({ force: true });
}

export { ESCRITORIO_VAZIO };
