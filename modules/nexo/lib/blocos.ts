/**
 * BLOCOS: o volume de várias disciplinas.
 *
 * A regra do escritório, lida dos projetos reais (040-26, 113-22, 116-25,
 * 156-25): um volume tem UMA capa e, depois dela, um bloco por disciplina —
 * separatriz → LD → pranchas daquela disciplina. O volume 10 de 040-26
 * (`his_inc_spd`) tem uma capa e TRÊS separatrizes e TRÊS LDs, uma por
 * disciplina; o volume 3 (`top_snd_gmt_ter_dre_pav`) tem seis.
 *
 * Até aqui o Nexo tratava todo volume como se fosse de uma disciplina só: a
 * proposta da LD escolhia a disciplina MAJORITÁRIA (`mode`) e as folhas das
 * outras cinco entravam sob aquele título, caladas. Não era um aviso que
 * faltava — era o documento saindo errado sem ninguém ver.
 *
 * Um bloco NÃO é um tomo. Tomo é o mesmo volume repartido em PDFs separados
 * porque ficou grosso demais (040-26 `est` → tomo1..tomo4, quatro arquivos);
 * bloco é uma seção DENTRO de um volume. Por isso vivem em módulos separados e
 * não se misturam: `gruposDasFolhas` reparte por quantidade, aqui agrupa-se por
 * disciplina.
 *
 * RODA EM NODE PELADO (`scripts/test-nexo-blocos.ts`): o único import de runtime
 * é `disciplinas.ts`, que não importa nada e entra por caminho relativo COM
 * extensão. O léxico do escritório e as disciplinas lidas do nome do arquivo
 * continuam chegando INJETADOS — quem os amarra é `disciplina-da-folha.ts`, que
 * não é testável em node cru porque o parser de nome de arquivo importa por
 * caminho sem extensão.
 */

import { temLd, temSeparatriz } from "../../../server/nexo/disciplinas.ts";
import type { Folha, FolhaId } from "./folhas.ts";

/** minúsculas, sem acento — o léxico do escritório já está sem acento. */
function normalizar(valor: string): string {
  return valor
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * As duas tabelas de consulta do léxico, derivadas uma vez.
 *
 * `canonico` existe porque o léxico tem grafias irmãs para a mesma disciplina —
 * `elt` e `ele` são "Eletrico", `cft` e `cftv` são "CFTV". Sem canonizar, um
 * volume que use as duas grafias sairia com dois blocos e duas separatrizes
 * para a mesma disciplina. Vence a primeira chave declarada, que é a grafia que
 * o escritório usa nas pastas.
 */
export interface TabelasDoLexico {
  canonico: Map<string, string>;
  porRotulo: Map<string, string>;
  /**
   * Os QUALIFICADORES, do mais longo para o mais curto: `[termo, codigo]`.
   *
   * Ordenados na construção porque a busca precisa do mais específico primeiro,
   * e ordenar a cada folha custaria a ordenação 200 vezes por projeto.
   */
  porTermo: readonly (readonly [string, string])[];
}

export function tabelasDoLexico(
  lexico: Record<string, string>,
  /** Termos que qualificam a disciplina. Ver `termos` em `disciplinas.ts`. */
  qualificadores: Record<string, readonly string[]> = {},
): TabelasDoLexico {
  const canonico = new Map<string, string>();
  const porRotulo = new Map<string, string>();
  for (const [codigo, rotulo] of Object.entries(lexico)) {
    const chave = normalizar(rotulo);
    if (!porRotulo.has(chave)) porRotulo.set(chave, codigo);
    canonico.set(codigo, porRotulo.get(chave)!);
  }
  const porTermo = Object.entries(qualificadores)
    .flatMap(([codigo, termos]) =>
      termos.map((t) => [normalizar(t), canonico.get(codigo) ?? codigo] as const),
    )
    .sort((a, b) => b[0].length - a[0].length);
  return { canonico, porRotulo, porTermo };
}

/**
 * Código a partir do que o carimbo (ou o engenheiro) escreveu.
 *
 * Casa o código cru ("DRE"), o rótulo inteiro ("Drenagem") e o rótulo como
 * PREFIXO ("Estrutural Concreto" → `est`) — o carimbo qualifica a disciplina, e
 * exigir igualdade exata jogaria fora a maioria das leituras boas. Entre dois
 * prefixos que casam vence o MAIS LONGO: senão "Estrutura metalica" cairia em
 * "Estrutural" e a metálica entraria no bloco do concreto.
 */
export function codigoDoRotulo(
  valor: string | null | undefined,
  tabelas: TabelasDoLexico,
): string {
  const texto = normalizar(valor ?? "");
  if (!texto) return "";
  const cru = tabelas.canonico.get(texto);
  if (cru) return cru;
  const exato = tabelas.porRotulo.get(texto);
  if (exato) return exato;

  /*
   * O QUALIFICADOR VEM ANTES DO PREFIXO — é o degrau que faltava.
   *
   * O carimbo escreve "ESTRUTURAL METÁLICO". Isso COMEÇA com "Estrutural"
   * (`est`) e não começa com "Estrutura metálica" (`met`), então o prefixo
   * mais longo escolhia o concreto: as pranchas de metálico entravam no bloco
   * do concreto e a capa e a LD saíam com "PROJETO ESTRUTURAL CONCRETO". A
   * ordem por tamanho, que existia para desempatar prefixos, não alcançava o
   * caso — o rótulo do metálico nem chegava a ser candidato.
   *
   * DOIS CÓDIGOS DIFERENTES QUALIFICANDO O MESMO TEXTO NÃO DECIDEM. "Estrutural
   * concreto e metálico" numa folha só é uma folha que o sistema não sabe
   * classificar; cai no prefixo, e se ele também não resolver a folha vai para
   * o bloco "sem disciplina" — que é honesto e visível, ao contrário de meio
   * volume com o título errado.
   */
  const qualificam = tabelas.porTermo.filter(([termo]) => texto.includes(termo));
  if (qualificam.length > 0) {
    const codigos = new Set(qualificam.map(([, codigo]) => codigo));
    if (codigos.size === 1) return qualificam[0][1];
  }

  let melhor = "";
  let tamanho = 0;
  for (const [rotulo, codigo] of tabelas.porRotulo) {
    if (texto.startsWith(rotulo) && rotulo.length > tamanho) {
      melhor = codigo;
      tamanho = rotulo.length;
    }
  }
  return melhor;
}

/** As três fontes possíveis da disciplina de uma folha, já lidas. */
export interface FontesDaDisciplina {
  /** O que a pessoa corrigiu à mão, ou vazio. */
  manual: string;
  /** Códigos que o NOME DO ARQUIVO carrega, já canonizados. */
  doNome: readonly string[];
  /** O que o carimbo diz (rótulo por extenso, do OCR). */
  doCarimbo: string;
}

/**
 * A REGRA: correção manual → nome do arquivo → carimbo.
 *
 * O nome vem antes do carimbo porque é a convenção do escritório
 * (`040_26_dre_002_a.pdf`) e é ela que organiza as pastas de onde o volume
 * nasce; o carimbo sai de OCR e erra.
 *
 * O nome com MAIS DE UMA disciplina não decide nada: é o arquivo do volume
 * inteiro (`040_26_vol10_his_inc_spd_a.pdf`), e dizer que as 30 folhas dele são
 * todas "his" produziria um volume com uma separatriz só e o nome errado nas
 * outras duas. Aí quem decide é o carimbo, que é por página. Sem nenhuma das
 * três, a folha fica sem código — e vai para o bloco final de "sem disciplina",
 * que é honesto: o sistema não sabe, e fingir que sabe põe título errado numa
 * separatriz.
 */
export function escolherCodigo(
  fontes: FontesDaDisciplina,
  tabelas: TabelasDoLexico,
): string {
  const manual = codigoDoRotulo(fontes.manual, tabelas);
  if (manual) return manual;
  if (fontes.doNome.length === 1) return fontes.doNome[0];
  return codigoDoRotulo(fontes.doCarimbo, tabelas);
}

/** Uma seção do volume: a disciplina e as folhas que entram sob ela. */
export interface Bloco {
  /**
   * Código de três letras do escritório (`top`, `snd`, `arq`...) — a chave
   * canônica, a mesma que aparece nos nomes de arquivo. Vazio quando não deu
   * para descobrir a disciplina da folha.
   */
  codigo: string;
  /** Rótulo de exibição ("Topografia"). Vazio quando o código é desconhecido. */
  rotulo: string;
  /** As folhas deste bloco, na ordem da projeção. */
  ids: FolhaId[];
}

/**
 * Este bloco gera a LD (ou a separatriz) que o plano ia oferecer?
 *
 * A tabela do escritório (14/08/2026) diz que SONDAGEM NÃO TEM LD, e até aqui
 * ninguém perguntava: o plano criava uma LD por bloco, sempre, e o volume de
 * sondagem saía com um documento que o escritório não entrega. `temLd` e
 * `temSeparatriz` existiam em `disciplinas.ts` e não eram chamados por ninguém.
 *
 * A pergunta é do BLOCO, não do volume: num volume misto, sondagem fica sem LD e
 * as outras disciplinas continuam com as suas.
 *
 * SEM BLOCO RESPONDE SIM, e o mesmo vale para código vazio ou fora do léxico. A
 * assimetria é a de sempre: uma LD a mais é uma aba que se fecha; uma a menos é
 * um documento que falta no volume entregue — e ninguém descobre, porque o item
 * simplesmente não aparece no plano. `blocosDasFolhas` produz bloco de código
 * vazio toda vez que o nome do arquivo não declara disciplina, que é comum.
 */
export function blocoGera(
  parte: "ld" | "separatriz",
  bloco?: { codigo: string },
): boolean {
  const codigo = bloco?.codigo?.trim();
  if (!codigo) return true;
  return parte === "ld" ? temLd(codigo) : temSeparatriz(codigo);
}

/**
 * Agrupa as folhas por disciplina, na ordem em que cada disciplina APARECE.
 *
 * Agrupa, não fatia em corridas: se as folhas chegam top, snd, top, saem DOIS
 * blocos (top com duas folhas, snd com uma) e não três. O escritório tem uma
 * pasta por disciplina, então uma disciplina é um bloco — uma folha fora de
 * ordem no meio da leitura não pode virar uma separatriz repetida no volume.
 *
 * As folhas sem disciplina lida caem num bloco de código vazio, sempre por
 * ÚLTIMO: elas não têm título de separatriz, e enfiá-las no meio empurraria as
 * disciplinas de verdade para fora da ordem do escritório. Quando NENHUMA folha
 * tem disciplina, sai um bloco só — que é exatamente o volume de disciplina
 * única de antes, sem regra especial.
 */
export function blocosDasFolhas(
  lista: readonly Folha[],
  codigoDe: (folha: Folha) => string,
  rotuloDe: (codigo: string) => string,
): Bloco[] {
  const porCodigo = new Map<string, FolhaId[]>();
  for (const folha of lista) {
    const codigo = codigoDe(folha).trim().toLowerCase();
    const ids = porCodigo.get(codigo);
    if (ids) ids.push(folha.id);
    else porCodigo.set(codigo, [folha.id]);
  }

  const blocos: Bloco[] = [];
  for (const [codigo, ids] of porCodigo) {
    if (codigo === "") continue;
    blocos.push({ codigo, rotulo: rotuloDe(codigo), ids });
  }
  const soltas = porCodigo.get("");
  if (soltas) blocos.push({ codigo: "", rotulo: "", ids: soltas });
  return blocos;
}

/**
 * O volume mistura disciplinas — precisa de uma separatriz e uma LD por bloco.
 *
 * Um bloco sem código não conta como disciplina: um volume de arquitetura com
 * duas pranchas ilegíveis continua sendo um volume de uma disciplina só, e
 * tratá-lo como misto faria a montagem pedir uma separatriz sem título.
 */
export function misturaDisciplinas(blocos: readonly Bloco[]): boolean {
  return blocos.filter((b) => b.codigo !== "").length > 1;
}

/** "Topografia (1) · Sondagem (1) · Drenagem (3)" — o volume numa linha. */
export function resumoDosBlocos(blocos: readonly Bloco[]): string {
  return blocos
    .map((b) => `${b.rotulo || "Sem disciplina"} (${b.ids.length})`)
    .join(" · ");
}

/**
 * Junta dois blocos num só, mantendo a posição do PRIMEIRO deles.
 *
 * Existe porque o escritório às vezes emite uma separatriz para duas
 * disciplinas: o volume 3 de 040-26 tem `separatriz_gmt_ter` e uma LD
 * `geo_ter_ld` cobrindo geométrico e terraplenagem juntos. A divisão
 * automática é o palpite; quem decide é o engenheiro — o mesmo princípio do
 * tomo arrastado à mão.
 *
 * O código do bloco fundido é o do primeiro, e o rótulo vira "A e B": é o que a
 * separatriz vai dizer, então tem de ser legível, não uma sigla inventada.
 */
export function fundirBlocos(
  blocos: readonly Bloco[],
  codigoA: string,
  codigoB: string,
): Bloco[] {
  const a = blocos.findIndex((b) => b.codigo === codigoA);
  const b = blocos.findIndex((x) => x.codigo === codigoB);
  if (a < 0 || b < 0 || a === b) return [...blocos];

  const primeiro = Math.min(a, b);
  const segundo = Math.max(a, b);
  const fundido: Bloco = {
    codigo: blocos[primeiro].codigo,
    rotulo: [blocos[primeiro].rotulo, blocos[segundo].rotulo]
      .filter(Boolean)
      .join(" e "),
    ids: [...blocos[primeiro].ids, ...blocos[segundo].ids],
  };
  return blocos
    .map((bloco, i) => (i === primeiro ? fundido : bloco))
    .filter((_, i) => i !== segundo);
}

/**
 * As CORRIDAS de disciplina na ordem da projeção — quantas folhas seguidas de
 * cada disciplina, antes de a próxima começar.
 *
 * Corridas, e não blocos: a divisão em tomos corta por POSIÇÃO na lista, então
 * o que precisa casar é a sequência real, não o agrupamento lógico. Num projeto
 * cujas folhas chegaram intercaladas, os blocos não são contíguos e cortar
 * "entre blocos" não teria onde cair — as corridas sempre têm.
 */
export function corridasDeDisciplina(
  lista: readonly Folha[],
  codigoDe: (folha: Folha) => string,
): number[] {
  const corridas: number[] = [];
  let atual = "";
  for (const folha of lista) {
    const codigo = codigoDe(folha).trim().toLowerCase();
    if (corridas.length === 0 || codigo !== atual) {
      corridas.push(1);
      atual = codigo;
    } else {
      corridas[corridas.length - 1] += 1;
    }
  }
  return corridas;
}

/**
 * A repartição em tomos que ESTA lista pede: por corrida de disciplina quando
 * elas existem, por contagem quando não.
 *
 * Devolve um `Repartir` pronto para `gruposDasFolhas`. O guarda do total é o que
 * torna isto seguro: `gruposDasFolhas` reparte só as folhas SEM grupo manual, e
 * quando alguém arrastou folhas no canvas as corridas não descrevem mais o que
 * vai ser repartido — aí a conta antiga volta, e a decisão de quem arrastou
 * continua valendo.
 */
export function repartirDaLista(
  lista: readonly Folha[],
  codigoDe: (folha: Folha) => string,
  porBlocos: (tamanhos: readonly number[], numTomos: number) => number[],
  porContagem: (total: number, numTomos: number) => number[],
): (total: number, numTomos: number) => number[] {
  const corridas = corridasDeDisciplina(lista, codigoDe);
  const soma = corridas.reduce((a, n) => a + n, 0);
  return (total, numTomos) =>
    total === soma ? porBlocos(corridas, numTomos) : porContagem(total, numTomos);
}
