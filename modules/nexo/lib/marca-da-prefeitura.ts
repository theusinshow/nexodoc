/**
 * A MARCA DE PREFEITURA — a mesma identidade em quatro geometrias.
 *
 * A REGRA QUE SEGURA TUDO É UMA SÓ: a marca aparece onde a cidade é uma
 * PERGUNTA EM ABERTO, e em nenhum outro lugar. No palco só existe uma obra e a
 * cor não distingue nada; no admin se filtra por texto; na saudação não há
 * projeto ainda. Nesses três a marca não entra — não por esquecimento, e sim
 * porque marca que não separa nada é decoração.
 *
 * QUATRO FORMAS, E A ESCOLHA É DA SUPERFÍCIE, não do gosto:
 *
 *   SINAL  (9×3)  na aresta, para LISTAS DENSAS — o cartão do histórico.
 *   SELO   (13×5) em linha com o texto, para SUPERFÍCIES LARGAS — faixa do
 *                 topo, cartão de projeto, cabeçalhos.
 *   BASTÃO (3×4)  vertical antes do texto, para LINHAS DE UMA SÓ ALTURA, onde
 *                 não existe aresta livre — a paleta de comandos.
 *   CHAPA  (22×7) a única que pode ser lida como imagem. Só onde a cidade é O
 *                 ASSUNTO da tela: a conferência antes de gerar. Uma por tela.
 *
 * A ORDEM DAS CORES NÃO MUDA ENTRE TELAS — principal, secundária, apoio. Só o
 * tamanho muda. Um arranjo diferente por tela faria a mesma cidade parecer duas.
 *
 * PREFEITURA DESCONHECIDA TEM MARCA, e é onde ela vale mais: três cinzas a 50%.
 * A ausência precisa de forma, senão vira buraco — e na ficha do drop o cinza no
 * topo é o aviso, antes da conferência linha a linha, de que esta capa vai sair
 * sem prefeitura decidida.
 *
 * PURO e sem imports → roda em node cru (`npm run test:nexo:marca`).
 */

/** As quatro geometrias. Ver o cabeçalho para qual superfície pede qual. */
export type FormaDaMarca = "sinal" | "selo" | "bastao" | "chapa";

export interface GeometriaDaMarca {
  /** Largura de um segmento, em px. */
  largura: number;
  /** Altura de um segmento, em px. */
  altura: number;
  /** Vão entre segmentos, em px. */
  gap: number;
  /** O bastão empilha; as outras três correm na horizontal. */
  empilhado: boolean;
  /** A medida no eixo em que os três segmentos se somam, em px. */
  total: number;
}

function medir(
  largura: number,
  altura: number,
  gap: number,
  empilhado = false,
): GeometriaDaMarca {
  const eixo = empilhado ? altura : largura;
  return { largura, altura, gap, empilhado, total: eixo * 3 + gap * 2 };
}

export const GEOMETRIA_DA_MARCA: Record<FormaDaMarca, GeometriaDaMarca> = {
  sinal: medir(9, 3, 2),
  selo: medir(13, 5, 2),
  bastao: medir(3, 4, 1, true),
  chapa: medir(22, 7, 2),
};

/**
 * Os municípios que o escritório atende, com as cores da bandeira.
 *
 * PRETO E BRANCO PUROS NÃO ENTRAM, e não é preciosismo de paleta: medido contra
 * o fundo do cartão, `#111111` dá contraste 1,00 — o segmento não parece uma
 * cor, parece um vão entre os outros dois. E `#FFFFFF` fica mais claro que o
 * texto mais forte da interface, então o terceiro segmento viraria a coisa mais
 * brilhante do cartão, acima do próprio nome do projeto. O carvão sobe até ter
 * contraste próprio e continua lendo como "o preto do escudo"; o branco desce um
 * degrau e continua sendo "o branco".
 *
 * O AMARELO DE CRICIÚMA ENCOSTA NO ÂMBAR de `--status-warning`, que é a cor do
 * "análise rodando" — no mesmo cartão, na cidade que mais aparece na lista. A
 * posição separa os dois (a marca está na aresta, o estado está no texto), e é
 * o único ponto do sistema em que identidade e estado dividem o campo visual.
 * Se incomodar na bancada, a saída NÃO é trocar o amarelo: é o carvão vir
 * primeiro e o amarelo segundo — a marca continua sendo amarelo-e-preto.
 */
const MUNICIPIOS: readonly { chave: string; nome: string }[] = [
  { chave: "florianopolis", nome: "FLORIANOPOLIS" },
  { chave: "sao-jose", nome: "SAO JOSE" },
  { chave: "criciuma", nome: "CRICIUMA" },
  { chave: "chapeco", nome: "CHAPECO" },
  { chave: "urubici", nome: "URUBICI" },
];

/** A chave de quem não se sabe. Nunca `null`, nunca espaço vazio. */
export const PREFEITURA_AUSENTE = "ausente";

/**
 * Maiúsculas, sem acento, hífen e sublinhado viram espaço.
 *
 * O hífen vira espaço porque a mesma prefeitura chega das duas formas: como
 * nome de pasta (`084-25-SAO JOSE`, montado por `centroDeCustoDaAuditoria`) e
 * como texto do carimbo (`PREFEITURA MUNICIPAL DE SÃO JOSÉ`).
 */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O MUNICÍPIO, tirado do que a tela tiver em mãos.
 *
 * Aceita as três formas que circulam: a pasta (`084-25-CRICIUMA`), o campo
 * CLIENTE do carimbo (`PREFEITURA MUNICIPAL DE CRICIÚMA / SECRETARIA DE
 * OBRAS`) e o município cru (`Criciúma`). Os enfeites saem na mesma ordem que
 * `centroDeCustoDaAuditoria` usa — é a mesma limpeza, e duas limpezas
 * diferentes fariam a pasta e a marca discordarem sobre a mesma obra.
 */
function municipioDoTexto(bruto: string): string {
  return normalizar(bruto)
    // "084-25-CRICIUMA" e "084 25 CRICIUMA" — o código da obra abre a pasta.
    .replace(/^\d{2,4}\s+\d{2,4}\s+/, "")
    .replace(/^PREFEITURA\s+(?:MUNICIPAL\s+)?(?:DE\s+|DO\s+|DA\s+)?/, "")
    .replace(/^MUNICIPIO\s+(?:DE\s+|DO\s+|DA\s+)?/, "")
    // "… / SECRETARIA DE EDUCAÇÃO" — o órgão vem inteiro, o município é a
    // primeira parte.
    .split("/")[0]
    // Sufixo de estado: "CRICIUMA SC", "CRICIUMA, SC".
    .replace(/[\s,]+[A-Z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A chave do município, ou `PREFEITURA_AUSENTE`.
 *
 * O CASAMENTO É EXATO, e de propósito. Casar por conteúdo pintaria "SÃO JOSÉ DO
 * CERRITO" com as cores de São José — e é o mesmo defeito que já custou caro no
 * casamento de prefeitura por texto, onde o município solto no meio de uma
 * frase virava falso positivo. Aqui o preço de errar é baixo (31px de cor
 * trocada), mas uma marca que mente é pior que uma marca cinza: a cinza diz
 * "não sei", que é verdade.
 */
export function chaveDaPrefeitura(bruto: string | null | undefined): string {
  const municipio = municipioDoTexto(bruto ?? "");
  if (!municipio) return PREFEITURA_AUSENTE;
  const achado = MUNICIPIOS.find((m) => m.nome === municipio);
  return achado ? achado.chave : PREFEITURA_AUSENTE;
}

/** Os três segmentos, em variáveis CSS. Nunca hex cru na tela. */
export type CoresDaMarca = readonly [string, string, string];

/**
 * As três cores, na ordem principal → secundária → apoio.
 *
 * Devolve `var(--prefeitura-*)` e não hex, pelo mesmo motivo que
 * `corDaDisciplina`: a cor mora em `globals.css`, com nome e consumidor
 * declarados, e o componente só a consome.
 */
export function coresDaPrefeitura(bruto: string | null | undefined): CoresDaMarca {
  const chave = chaveDaPrefeitura(bruto);
  return [
    `var(--prefeitura-${chave}-1)`,
    `var(--prefeitura-${chave}-2)`,
    `var(--prefeitura-${chave}-3)`,
  ];
}

/** `false` = cinza a 50%. A tela usa isto para apagar a marca, não para escondê-la. */
export function prefeituraConhecida(bruto: string | null | undefined): boolean {
  return chaveDaPrefeitura(bruto) !== PREFEITURA_AUSENTE;
}

/** As chaves mapeadas, na ordem do mapa. Para o teste e para telas de amostra. */
export function prefeiturasMapeadas(): readonly string[] {
  return MUNICIPIOS.map((m) => m.chave);
}
