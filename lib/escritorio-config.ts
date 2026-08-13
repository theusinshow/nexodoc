/**
 * De onde vêm os dados do escritório: da CONSTANTE, com escape por ambiente.
 *
 * Isto já foi banco + formulário no admin. Saiu em 13/08, por um argumento do
 * mantenedor que derruba o desenho anterior: **o escritório é um só** — o
 * produto é feito para ele. Um formulário para um dado que nunca muda tem um
 * defeito fatal justamente aqui: enquanto ninguém preenchesse, a subtração do
 * endereço não acontecia e o modo de falha Criciúma/Florianópolis continuava
 * solto. A constante protege desde o primeiro boot.
 *
 * O ambiente continua podendo sobrepor (`NEXODOC_ESCRITORIO_*`) — é o escape
 * para o dia em que o endereço mudar antes de haver deploy, e o que permite a
 * prova de navegador exercitar um escritório diferente do de produção.
 */
import { DadosDoEscritorio, ESCRITORIO, normalizarDadosDoEscritorio } from "@/lib/escritorio";

export type OrigemDoEscritorio = "constante" | "ambiente";

function doAmbiente(): DadosDoEscritorio | null {
  const nome = process.env.NEXODOC_ESCRITORIO_NOME;
  const endereco = process.env.NEXODOC_ESCRITORIO_ENDERECO;
  if (!nome && !endereco) return null;

  return normalizarDadosDoEscritorio({
    nome,
    enderecoImpresso: endereco,
    municipio: process.env.NEXODOC_ESCRITORIO_MUNICIPIO,
    uf: process.env.NEXODOC_ESCRITORIO_UF,
  });
}

/**
 * SÍNCRONA e sem I/O — era `async` por causa do banco, que não existe mais.
 * Quem chama continua podendo dar `await`, e os chamadores foram ajustados.
 */
export function carregarEscritorio(): DadosDoEscritorio {
  return doAmbiente() ?? ESCRITORIO;
}

/** Para telas e diagnóstico: o dado e de onde ele veio. */
export function carregarEscritorioComOrigem(): {
  dados: DadosDoEscritorio;
  origem: OrigemDoEscritorio;
} {
  const doEnv = doAmbiente();
  return doEnv
    ? { dados: doEnv, origem: "ambiente" }
    : { dados: ESCRITORIO, origem: "constante" };
}
