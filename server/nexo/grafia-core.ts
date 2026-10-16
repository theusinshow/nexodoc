/**
 * GRAFIA NAS PRANCHAS — o núcleo puro (16/10/2026).
 *
 * O pedido veio de um volume de topografia de terceirizado com "QUADRA DE
 * BOXA" (bocha). Medido antes de desenhar:
 *
 *   - o dicionário pt-BR ACEITA "boxa" (verbo boxar) e "calcada" (calcar): o
 *     erro que motivou o pedido é de CONTEXTO, e só quem lê a frase o pega;
 *   - o texto ÚNICO de um volume é pequeno: o 138-26 tem 33 pranchas, 48 mil
 *     caracteres extraídos e só 306 linhas distintas (~2 mil tokens). Desenho
 *     de CAD repete legenda, carimbo e "NV 0,00" em toda folha.
 *
 * Então a IA lê tudo, uma vez, e o dicionário corre junto como REDE: palavra
 * que não existe vira suspeita sempre, sem depender de a IA lembrar dela nesta
 * corrida. Este módulo é o que fica entre as duas fontes e o engenheiro:
 *
 *   - remove a repetição e guarda ONDE cada linha aparece;
 *   - descarta o achado da IA cujo trecho não está na linha (invenção);
 *   - descarta, em linha de fonte recuperada, o que é artefato do reparo;
 *   - mescla dicionário e IA num achado só por erro.
 *
 * SEM IMPORTS, para rodar no node cru (`npm run test:grafia`). Os tipos de
 * saída são os da conferência leve (`light-check-core.ts`), por forma.
 */

export interface ItemDeTextoDaFolha {
  texto: string;
  /** Veio de fonte sem mapa de caracteres e foi reparado: os acentos não valem. */
  recuperada: boolean;
}

export interface TextoDaFolha {
  /** O nome do arquivo — a mesma chave que o canvas usa para marcar a folha. */
  arquivo: string;
  pagina: number;
  itens: ItemDeTextoDaFolha[];
}

export interface Ocorrencia {
  arquivo: string;
  pagina: number;
}

export interface LinhaUnica {
  /** Número da linha no texto que vai à IA (1..N). */
  n: number;
  texto: string;
  recuperada: boolean;
  ocorrencias: Ocorrencia[];
}

export interface LinhasDoVolume {
  linhas: LinhaUnica[];
  /** Folhas com TODO o texto dentro do teto. */
  folhasLidas: number;
  folhasTotal: number;
}

/** Um erro que a IA apontou numa linha. */
export interface ErroDaIa {
  linha: number;
  errado: string;
  certo: string;
  motivo: string;
}

/** Uma palavra que o dicionário não conhece, e as linhas onde ela aparece. */
export interface SuspeitaDoDicionario {
  palavra: string;
  linhas: number[];
}

/** O que a IA disse de cada suspeita: erro (com a grafia certa) ou nome/termo. */
export interface JuizoDaSuspeita {
  palavra: string;
  erro: boolean;
  certo: string | null;
}

export type SeveridadeDaGrafia = "critico" | "aviso" | "info";

export interface AchadoDeGrafia {
  severidade: SeveridadeDaGrafia;
  campo: string;
  mensagem: string;
  detalhe?: string;
  folhas?: string[];
}

export interface ResultadoDaGrafia {
  veredito: "ok" | "aviso" | "critico";
  findings: AchadoDeGrafia[];
  linhasLidas: number;
  folhasLidas: number;
  folhasTotal: number;
}

/** O teto de texto único. ~17 mil tokens: folga de 8x sobre o 138-26. */
export const TETO_DE_CARACTERES = 60_000;

const CAMPO = "grafia";

function espacos(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function minusculo(texto: string): string {
  return texto.toLocaleLowerCase("pt-BR");
}

function semAcento(texto: string): string {
  return minusculo(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * É TEXTO que alguém escreveu, e não cota, código ou fonte embaralhada?
 *
 * Precisa de uma palavra de 3 letras, e de pouca pontuação estranha: a fonte
 * que o reparo não salvou sai como `35()(,785$081,&` ou `5XD6DOGDQKD0DULQKR`
 * — o primeiro tem símbolo demais, o segundo tem dígito colado em letra no
 * meio de uma "palavra" de 30 caracteres.
 */
export function linhaLegivel(texto: string): boolean {
  const t = espacos(texto);
  if (!/\p{L}{3,}/u.test(t)) return false;
  const estranhos = (t.match(/[$&%#@{}\\^~`|]/g) ?? []).length;
  const parenteses = (t.match(/[()]/g) ?? []).length;
  if (estranhos > 0 && estranhos / t.length > 0.03) return false;
  if (parenteses > 3) return false;
  const palavras = t.split(" ");
  const embaralhada = palavras.some(
    (p) => p.length >= 12 && /\p{L}\d+\p{L}/u.test(p) && !/[_-]/.test(p),
  );
  if (embaralhada) return false;
  const letras = (t.match(/\p{L}/gu) ?? []).length;
  return letras / t.replace(/\s/g, "").length >= 0.5;
}

/**
 * As linhas DISTINTAS do volume, na ordem em que aparecem, com cada lugar onde
 * aparecem. O teto corta folhas INTEIRAS no fim: uma folha conferida pela
 * metade diria "nada encontrado" sobre um texto que ninguém leu.
 */
export function linhasUnicas(
  folhas: readonly TextoDaFolha[],
  teto: number = TETO_DE_CARACTERES,
): LinhasDoVolume {
  const porTexto = new Map<string, LinhaUnica>();
  const linhas: LinhaUnica[] = [];
  let usados = 0;
  let folhasLidas = 0;
  let parou = false;

  for (const folha of folhas) {
    if (parou) break;
    const novas: { texto: string; recuperada: boolean }[] = [];
    const vistas = new Set<string>();
    for (const item of folha.itens) {
      const texto = espacos(item.texto);
      if (!texto || !linhaLegivel(texto) || vistas.has(texto)) continue;
      vistas.add(texto);
      if (!porTexto.has(texto)) novas.push({ texto, recuperada: item.recuperada });
    }
    const custo = novas.reduce((s, l) => s + l.texto.length + 1, 0);
    if (usados + custo > teto) {
      parou = true;
      break;
    }
    usados += custo;
    for (const nova of novas) {
      const linha: LinhaUnica = { n: linhas.length + 1, ...nova, ocorrencias: [] };
      porTexto.set(nova.texto, linha);
      linhas.push(linha);
    }
    for (const texto of vistas) {
      porTexto.get(texto)!.ocorrencias.push({ arquivo: folha.arquivo, pagina: folha.pagina });
    }
    folhasLidas++;
  }

  return { linhas, folhasLidas, folhasTotal: folhas.length };
}

/**
 * As palavras que vão ao dicionário. Fora: sigla curta em caixa alta (ASTM,
 * NBR), token com dígito (A572-50, Comb1), identificador colado (PesoProprio)
 * e o que tem menos de 4 letras — o dicionário não tem o que dizer deles, e
 * cada um viraria um "fora do dicionário" a mais para alguém ler.
 */
export function palavrasParaDicionario(linha: string): string[] {
  const out: string[] = [];
  for (const bruto of linha.split(/[\s,.;:!?()[\]{}"“”'‘’/=+*<>|]+/)) {
    const p = bruto.replace(/^-+|-+$/g, "");
    if (p.length < 4) continue;
    if (!/^\p{L}+(-\p{L}+)*$/u.test(p)) continue;
    const letras = p.replace(/-/g, "");
    if (letras === letras.toUpperCase() && letras.length <= 4) continue;
    if (/\p{Ll}\p{Lu}/u.test(p)) continue;
    out.push(p);
  }
  return out;
}

/**
 * Artefato do reparo de fonte: a letra acentuada desloca para uma MINÚSCULA no
 * meio da palavra em caixa alta ("REVITALIZAdO" por "REVITALIZAÇÃO"). É o
 * reparo falando, não o papel.
 */
function artefatoDoReparo(palavra: string): boolean {
  return /\p{Lu}{2,}\p{Ll}+\p{Lu}*/u.test(palavra) && palavra.replace(/\p{Ll}/gu, "").length >= 3;
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A CAMADA DE TEXTO do PDF errou, não o papel (corrida real do 138-26,
 * 16/10/2026): a fonte do CAD desenha "Cerâmica" e o texto extraído diz
 * "Cerkmica". O padrão é fixo — cada letra acentuada da palavra certa virou
 * OUTRA letra qualquer (â→k, Ç→d, é→p) ou sumiu ("EMISSO"), e o resto é
 * idêntico.
 *
 * Quem esquece acento escreve a LETRA-BASE (ç→c, ã→a): esse caso fica de fora
 * daqui (o lookahead recusa a base) e continua sendo info.
 */
function artefatoDeCodificacao(errado: string, certo: string): boolean {
  let acentuadas = 0;
  const partes = [...certo.normalize("NFC")].map((c) => {
    const base = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (base === c) return escapar(c);
    acentuadas++;
    return `(?:(?!${escapar(base)})\\S)?`;
  });
  if (acentuadas === 0) return false;
  return new RegExp(`^${partes.join("")}$`, "iu").test(errado.normalize("NFC"));
}

function contem(linha: string, trecho: string): boolean {
  return minusculo(linha).includes(minusculo(trecho));
}

/**
 * Só acento é INFO; letra trocada é AVISO. Desenho de CAD sai muito sem acento
 * ("RESISTENCIA", "NIVEL", "ELETRICA", nas amostras de 16/10/2026) — como aviso,
 * afogaria o erro de letra, que é o que muda o sentido da prancha.
 */
function gravidade(errado: string, certo: string): SeveridadeDaGrafia {
  return semAcento(errado) === semAcento(certo) ? "info" : "aviso";
}

interface Grupo {
  errado: string;
  certo: string;
  motivo: string;
  severidade: SeveridadeDaGrafia;
  linhas: Set<number>;
}

function chave(errado: string, certo: string): string {
  return `${minusculo(errado)}→${minusculo(certo)}`;
}

function listaDePaginas(ocorrencias: readonly Ocorrencia[]): string {
  const porArquivo = new Map<string, number[]>();
  for (const o of ocorrencias) {
    const paginas = porArquivo.get(o.arquivo) ?? [];
    if (!paginas.includes(o.pagina)) paginas.push(o.pagina);
    porArquivo.set(o.arquivo, paginas);
  }
  return [...porArquivo]
    .map(([arquivo, paginas]) => `${arquivo} p. ${paginas.sort((a, b) => a - b).join(", ")}`)
    .join("; ");
}

/**
 * Junta as duas fontes num resultado da conferência.
 *
 * - erro da IA que passa na trava → aviso (info se for só acento);
 * - suspeita do dicionário que a IA chamou de erro → aviso (o mesmo achado,
 *   se a IA já o tinha apontado);
 * - suspeita que a IA chamou de nome ou termo técnico → some;
 * - suspeita que a IA NÃO julgou → info. É a rede: a IA esqueceu, o
 *   dicionário não.
 *
 * Grafia nunca é crítico. Uma palavra errada pede revisão, não segura a
 * emissão do volume.
 */
export function montarResultadoDaGrafia(args: LinhasDoVolume & {
  erros: readonly ErroDaIa[];
  suspeitas: readonly SuspeitaDoDicionario[];
  juizos: readonly JuizoDaSuspeita[];
}): ResultadoDaGrafia {
  const porNumero = new Map(args.linhas.map((l) => [l.n, l]));
  const grupos = new Map<string, Grupo>();
  const corrigidas = new Set<string>();

  const anotar = (
    linha: LinhaUnica,
    errado: string,
    certo: string,
    motivo: string,
    severidade: SeveridadeDaGrafia,
  ) => {
    const k = chave(errado, certo);
    const grupo = grupos.get(k);
    if (grupo) {
      grupo.linhas.add(linha.n);
      return;
    }
    grupos.set(k, { errado, certo, motivo, severidade, linhas: new Set([linha.n]) });
  };

  for (const e of args.erros) {
    const linha = porNumero.get(e.linha);
    const errado = espacos(e.errado ?? "");
    const certo = espacos(e.certo ?? "");
    if (!linha || errado.length < 2 || !certo) continue;
    if (minusculo(errado) === minusculo(certo)) continue;
    if (!contem(linha.texto, errado)) continue;
    if (artefatoDeCodificacao(errado, certo)) continue;
    if (linha.recuperada) {
      if (semAcento(errado) === semAcento(certo)) continue;
      if (errado.split(" ").some(artefatoDoReparo)) continue;
    }
    anotar(linha, errado, certo, espacos(e.motivo ?? ""), gravidade(errado, certo));
    corrigidas.add(minusculo(errado));
  }

  const juizoDe = new Map(args.juizos.map((j) => [minusculo(j.palavra), j]));
  for (const s of args.suspeitas) {
    const palavra = minusculo(s.palavra);
    if (corrigidas.has(palavra)) continue;
    const linhasDaSuspeita = s.linhas
      .map((n) => porNumero.get(n))
      .filter((l): l is LinhaUnica => Boolean(l) && !l!.recuperada);
    if (linhasDaSuspeita.length === 0) continue;
    const juizo = juizoDe.get(palavra);
    if (juizo && !juizo.erro) continue;
    const certo = juizo?.certo ? espacos(juizo.certo) : "";
    // A palavra só existe porque a fonte codificou mal o acento: some de vez.
    if (juizo?.erro && certo && artefatoDeCodificacao(s.palavra, certo)) continue;
    for (const linha of linhasDaSuspeita) {
      if (juizo?.erro && certo && minusculo(certo) !== palavra) {
        anotar(linha, s.palavra, certo, "", gravidade(s.palavra, certo));
      } else {
        anotar(linha, s.palavra, "", "fora do dicionário — conferir", "info");
      }
    }
  }

  const findings: AchadoDeGrafia[] = [...grupos.values()]
    .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "aviso" ? -1 : 1))
    .map((g) => {
      const linhas = [...g.linhas].map((n) => porNumero.get(n)!);
      const ocorrencias = linhas.flatMap((l) => l.ocorrencias);
      const arquivos = [...new Set(ocorrencias.map((o) => o.arquivo))];
      const exemplo = linhas[0].texto.length > 120 ? `${linhas[0].texto.slice(0, 117)}…` : linhas[0].texto;
      const mensagem = g.certo
        ? `"${g.errado}" → "${g.certo}"`
        : `"${g.errado}" está fora do dicionário — conferir`;
      const detalhe = [
        g.motivo && g.certo ? g.motivo : "",
        `em: "${exemplo}"`,
        listaDePaginas(ocorrencias),
      ]
        .filter(Boolean)
        .join(" · ");
      return { severidade: g.severidade, campo: CAMPO, mensagem, detalhe, folhas: arquivos };
    });

  if (args.folhasLidas < args.folhasTotal) {
    findings.push({
      severidade: "info",
      campo: CAMPO,
      mensagem: `Grafia conferida em ${args.folhasLidas} de ${args.folhasTotal} folhas — o texto do volume passou do teto.`,
    });
  }

  const veredito = findings.some((f) => f.severidade === "aviso") ? "aviso" : "ok";
  return {
    veredito,
    findings,
    linhasLidas: args.linhas.length,
    folhasLidas: args.folhasLidas,
    folhasTotal: args.folhasTotal,
  };
}

interface ConferenciaLeve {
  veredito: "ok" | "aviso" | "critico";
  findings: AchadoDeGrafia[];
}

const PESO = { ok: 0, aviso: 1, critico: 2 } as const;

/**
 * A conferência do botão "Conferir": a leve MAIS a grafia, num resultado só —
 * é ele que a coluna do canvas lê. Grafia que falhou (rede, teto) não derruba a
 * leve: vira um aviso dizendo que a grafia não foi conferida, porque "nada
 * encontrado" sobre um texto que ninguém leu seria mentira.
 */
export function comGrafia<T extends ConferenciaLeve>(
  leve: T,
  grafia: ResultadoDaGrafia | { erro: string },
): T {
  const achados: AchadoDeGrafia[] =
    "erro" in grafia
      ? [{ severidade: "aviso", campo: CAMPO, mensagem: `Grafia não conferida: ${grafia.erro}` }]
      : grafia.findings;
  const pior = [leve.veredito, ...achados.map((a) => (a.severidade === "info" ? "ok" : a.severidade))].reduce(
    (a, b) => (PESO[b as keyof typeof PESO] > PESO[a as keyof typeof PESO] ? b : a),
    "ok",
  ) as ConferenciaLeve["veredito"];
  return { ...leve, veredito: pior, findings: [...leve.findings, ...achados] };
}
