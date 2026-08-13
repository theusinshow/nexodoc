/**
 * OS DADOS DO ESCRITÓRIO — quem emite, não quem recebe.
 *
 * Existe por causa de um acidente concreto: um volume de Criciúma saiu inteiro
 * como Florianópolis. A causa não foi a IA. O endereço do escritório — "Rua
 * Saldanha Marinho... Centro - Florianópolis - SC" — está impresso nas 71
 * pranchas, e o casamento cidade→template lia essa linha como se fosse o
 * cliente. O remendo da época (`nomeiaOrgao`, em `server/nexo/agent/normalize.ts`)
 * exige que o texto NOMEIE um órgão, e segura o caso comum. Mas ele deduz o
 * escritório por ausência: o sistema nunca soube qual é o próprio endereço.
 *
 * Aqui ele passa a saber. Declarado o escritório, a linha dele é SUBTRAÍDA do
 * texto antes de qualquer casamento — o que sobra é o que fala do cliente.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:escritorio`). A leitura
 * do banco mora em `lib/escritorio-config.ts`, que consome este módulo.
 */

export interface DadosDoEscritorio {
  /** Como o escritório se chama impresso. */
  nome: string;
  /** A linha de endereço COMO SAI IMPRESSA na prancha, sem reordenar. */
  enderecoImpresso: string;
  /** O município do escritório. É o campo que morde: ver o docblock acima. */
  municipio: string;
  /** UF em duas letras. */
  uf: string;
}

export const ESCRITORIO_VAZIO: DadosDoEscritorio = {
  nome: "",
  enderecoImpresso: "",
  municipio: "",
  uf: "",
};

/**
 * O ESCRITÓRIO DESTE SOFTWARE.
 *
 * Este produto é feito para um escritório só, e o emissor é sempre o mesmo. Era
 * campo de formulário até 13/08 — e formulário tem um defeito fatal para o que
 * este dado faz: **enquanto ninguém preenchesse, a subtração não acontecia** e o
 * modo de falha continuava solto. Constante protege por padrão, no primeiro
 * boot, sem depender de alguém lembrar.
 *
 * Mudar de endereço passa a ser um commit. É honesto: acontece uma vez por
 * década, e o `.env` continua servindo de escape para o dia em que acontecer
 * antes de um deploy (`NEXODOC_ESCRITORIO_*`).
 *
 * NÃO ENTRAM AQUI o responsável técnico e o CREA. Não são do escritório: são de
 * quem assina AQUELE projeto, e podem mudar por disciplina. Congelá-los numa
 * constante arriscaria imprimir capa com o engenheiro errado — o tipo de erro
 * que este produto existe para impedir, não para cometer.
 */
export const ESCRITORIO: DadosDoEscritorio = {
  nome: "PROSUL",
  /*
   * O que casa de fato é o LOGRADOURO ("rua saldanha marinho"): é a parte que
   * sobrevive a um carimbo lido pela metade, e é ela que carrega o município
   * que confundia o casamento. Número e complemento entram por completude, e
   * variação neles não quebra a subtração.
   */
  enderecoImpresso: "Rua Saldanha Marinho, 110, Centro - Florianópolis - SC",
  municipio: "Florianópolis",
  uf: "SC",
};

const LIMITE = 200;

/** minúsculas + sem acento + espaço colapsado. Mesma régua de `normalize.ts`. */
function norm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().slice(0, LIMITE) : "";
}

/** Aceita o que vier (formulário, banco, JSON) e devolve a forma canônica. */
export function normalizarDadosDoEscritorio(bruto: unknown): DadosDoEscritorio {
  const fonte = (bruto ?? {}) as Partial<Record<keyof DadosDoEscritorio, unknown>>;
  return {
    nome: texto(fonte.nome),
    enderecoImpresso: texto(fonte.enderecoImpresso),
    municipio: texto(fonte.municipio),
    uf: texto(fonte.uf).toUpperCase(),
  };
}

/**
 * O que impede de salvar. Vazio é SEMPRE válido: escritório não declarado é o
 * estado de hoje, e o sistema tem de continuar funcionando nele — a subtração
 * simplesmente não acontece.
 */
export function validarDadosDoEscritorio(dados: DadosDoEscritorio): string[] {
  const erros: string[] = [];

  if (dados.uf && !/^[A-Z]{2}$/.test(dados.uf)) {
    erros.push("UF deve ter duas letras (ex.: SC).");
  }
  if (dados.municipio && !dados.uf) {
    erros.push("Município sem UF: informe a UF para o endereço ficar sem ambiguidade.");
  }
  if (dados.enderecoImpresso && !dados.municipio) {
    erros.push(
      "Endereço impresso sem município: é o município que o casamento cidade→template confunde com o cliente.",
    );
  }

  return erros;
}

/** Há o bastante para a subtração valer? Sem isto, nada muda no casamento. */
export function escritorioDeclarado(dados: DadosDoEscritorio): boolean {
  return Boolean(dados.nome.trim() || dados.enderecoImpresso.trim());
}

/**
 * As MARCAS do escritório dentro de um texto: os pedaços cuja presença só pode
 * ser explicada pelo emissor.
 *
 * O município SOZINHO não é marca, e essa é a decisão que sustenta a função.
 * Removê-lo destruiria o caso legítimo: um trabalho PARA a prefeitura da mesma
 * cidade do escritório diz "Prefeitura Municipal de Florianópolis", e apagar
 * "florianopolis" deixaria "prefeitura municipal de" — que não casa com nada.
 * O falso negativo seria pior que o falso positivo que viemos consertar, porque
 * a pergunta ao humano vira silêncio.
 *
 * Marca é o nome do escritório e a linha de endereço (inteira e o logradouro,
 * porque o carimbo raramente é lido inteiro). "Município - UF" entra só depois
 * de o texto já ter sido reconhecido como do escritório por outra marca.
 */
function marcasDoEscritorio(dados: DadosDoEscritorio): string[] {
  const marcas: string[] = [];
  const nome = norm(dados.nome);
  const endereco = norm(dados.enderecoImpresso);

  if (nome.length >= 4) marcas.push(nome);
  if (endereco.length >= 8) {
    marcas.push(endereco);
    // O logradouro é a parte que sobrevive a um carimbo mal lido.
    const logradouro = endereco.split(",")[0]?.trim() ?? "";
    if (logradouro.length >= 8 && logradouro !== endereco) marcas.push(logradouro);
  }

  return marcas;
}

/**
 * O texto sem o que pertence ao escritório. Devolve na forma NORMALIZADA — quem
 * consome (`matchPrefeitura`) normaliza de novo, e normalizar é idempotente.
 *
 * Sem escritório declarado, devolve o texto normalizado e nada mais: é o
 * comportamento de hoje, preservado por construção.
 */
export function textoSemOEscritorio(texto: string, dados: DadosDoEscritorio): string {
  const alvo = norm(texto);
  if (!alvo || !escritorioDeclarado(dados)) return alvo;

  const marcas = marcasDoEscritorio(dados);
  let restante = alvo;
  let achou = false;

  for (const marca of marcas) {
    if (restante.includes(marca)) {
      restante = restante.split(marca).join(" ");
      achou = true;
    }
  }

  /*
   * "Município - UF" só cai DEPOIS de o escritório já ter sido reconhecido no
   * texto. Assim a cidade do escritório continua podendo ser cliente em todo
   * texto que não traga a linha dele junto.
   */
  if (achou && dados.municipio) {
    const cidade = norm(dados.municipio);
    const uf = norm(dados.uf);
    for (const par of [`${cidade} - ${uf}`, `${cidade}-${uf}`, `${cidade}/${uf}`]) {
      if (uf && restante.includes(par)) restante = restante.split(par).join(" ");
    }
  }

  return restante.replace(/\s+/g, " ").trim();
}

/**
 * Os marcadores de ODT que o escritório alimenta. O modelo que não tiver o
 * marcador não é tocado — é o mesmo contrato dos extras em `server/odt`.
 */
export function marcadoresDoEscritorio(
  dados: DadosDoEscritorio,
): Record<string, string> {
  const marcadores: Record<string, string> = {};
  if (dados.nome) marcadores.ESCRITORIO = dados.nome;
  if (dados.enderecoImpresso) marcadores.ESCRITORIO_ENDERECO = dados.enderecoImpresso;
  return marcadores;
}
