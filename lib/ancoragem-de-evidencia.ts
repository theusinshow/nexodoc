/**
 * O TRECHO CITADO EXISTE MESMO NA PÁGINA DECLARADA?
 *
 * Esta era a alma de `scripts/prova-evidencia-ancorada.ts`, e saiu de lá porque
 * ganhou um segundo consumidor: o chat advogado do diabo confere a evidência do
 * achado que ele mesmo propõe ANTES de gravá-lo (`registrar_achado`), e é a
 * mesma pergunta. Duas implementações da mesma pergunta acabam discordando
 * sobre a mesma folha — e a que discordasse acusaria de invenção quem citou
 * certo, que é o erro mais caro que este sistema pode cometer.
 *
 * O casamento é TOLERANTE de propósito: o pdf.js reflui espaço, hifeniza e às
 * vezes perde acento. Cobrar igualdade literal reprovaria transcrição boa.
 */

export type PaginaDeTexto = { page: number; text: string };

export type IndiceDeAncoragem = {
  /** Página → corpo esqueletizado, já sem o carimbo das bordas. */
  porPagina: Map<number, string>;
  /** Os corpos concatenados: onde se procura quando a página declarada falha. */
  documentoInteiro: string;
  nInicio: number;
  nFim: number;
};

export type Veredito = "ancorada" | "outra_pagina" | "nao_encontrada" | "sem_transcricao";

/** Só letras e dígitos, minúsculo, sem acento: imune a refluxo de espaço. */
export function esqueleto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * O esqueleto MAIS o índice de onde cada caractere estava no original.
 *
 * A busca do chat casa no esqueleto (imune a acento e a espaço reflowado) e
 * precisa devolver o trecho COMO ESTÁ ESCRITO na folha. Sem o mapa, o chat
 * mostraria ao engenheiro um texto sem acento e sem pontuação, que não é o que
 * ele vai encontrar quando abrir o PDF para conferir.
 *
 * Normaliza CARACTERE A CARACTERE, e não a string inteira: uma letra acentuada
 * vira dois code points em NFD, e normalizar tudo de uma vez deslocaria o
 * recorte a partir do primeiro acento da página.
 */
export function esqueletoComMapa(texto: string): { skeleton: string; indices: number[] } {
  const bruto = String(texto ?? "");
  let skeleton = "";
  const indices: number[] = [];

  for (let i = 0; i < bruto.length; i += 1) {
    const limpo = bruto[i]
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    for (const c of limpo) {
      if (/[a-z0-9]/.test(c)) {
        skeleton += c;
        indices.push(i);
      }
    }
  }

  return { skeleton, indices };
}

/**
 * Os trechos citados dentro de uma evidência.
 *
 * O campo costuma vir como `Página 57: "ABNT NBR 9574:2008 - Execução"`. O que
 * se procura no documento é o que está entre aspas — o resto é moldura escrita
 * pelo auditor.
 */
export function trechosCitados(evidencia: unknown): string[] {
  const bruto = String(evidencia ?? "");
  const aspas = [...bruto.matchAll(/[“"'‘]([^”"'’]{12,})[”"'’]/g)].map(
    (m) => m[1],
  );
  if (aspas.length > 0) return aspas;

  // Sem aspas: tira o rótulo "p. 41:" / "Página 57:" e usa o resto.
  const semRotulo = bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e-]+:?\s*/i, "");
  return semRotulo.trim().length >= 12 ? [semRotulo.trim()] : [];
}

/**
 * As páginas que o achado declara.
 *
 * Sem teto na largura da faixa: um achado de capítulo inteiro escreve
 * "159-202", e recusar a faixa por ser larga deixava só 159 e 202 — o trecho
 * citado morava na 160 e seria dado como inexistente. Aqui a faixa é a
 * declaração do auditor sobre onde procurar, não uma suspeita a ser limitada.
 */
export function paginasDe(raw: unknown): number[] {
  const txt = String(raw ?? "").replace(/[–—]/g, "-");
  const out = new Set<number>();

  for (const m of txt.matchAll(/(\d{1,4})\s*-\s*(\d{1,4})/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b >= a && b - a <= 400) for (let p = a; p <= b; p++) out.add(p);
  }
  for (const m of txt.matchAll(/\d{1,4}/g)) out.add(Number(m[0]));

  return [...out].filter((n) => n > 0 && n < 5000);
}

/**
 * O CARIMBO DE PÁGINA, FORA DO CAMINHO.
 *
 * Toda página do memorial carrega o mesmo rodapé e o mesmo cabeçalho de
 * capítulo, e eles caem NO MEIO das frases: a p.61 termina em "Para melhor
 * amarração com a alvenaria" e a p.62 recomeça em "existente, evitando
 * fissura". O auditor remonta a frase e cita certo; quem erra é quem confere
 * colando as páginas com o carimbo entre elas — e acusaria de invenção uma
 * transcrição exata.
 */
function comumNasBordas(paginas: string[], modo: "inicio" | "fim"): number {
  if (paginas.length < 4) return 0;

  const car = (s: string, i: number) => (modo === "inicio" ? s[i] : s[s.length - 1 - i]);
  const menor = Math.min(...paginas.map((p) => p.length));
  let n = 0;

  while (n < menor && n < 400) {
    const alvo = car(paginas[0], n);
    // "quase todas" e não "todas": uma página de tabela ou a capa quebram a
    // igualdade total sem que o carimbo deixe de existir nas outras 210.
    const quantas = paginas.filter((p) => car(p, n) === alvo).length;
    if (quantas < paginas.length * 0.6) break;
    n++;
  }

  return n;
}

export function indexarParaAncoragem(paginas: readonly PaginaDeTexto[]): IndiceDeAncoragem {
  // Dígitos viram "#" só para DETECTAR a borda: o número de página muda, o
  // resto não.
  const semDigitos = paginas.map((p) => esqueleto(p.text).replace(/\d/g, "#"));
  const nInicio = comumNasBordas(semDigitos, "inicio");
  const nFim = comumNasBordas(semDigitos, "fim");

  const porPagina = new Map<number, string>();
  const corpos: string[] = [];

  for (const p of paginas) {
    const cru = esqueleto(p.text);
    const corpo = cru.slice(nInicio, cru.length - nFim);
    porPagina.set(p.page, corpo);
    corpos.push(corpo);
  }

  return { porPagina, documentoInteiro: corpos.join(""), nInicio, nFim };
}

/**
 * Os pedaços procuráveis de um trecho.
 *
 * A ELISÃO PARTE A BUSCA EM DUAS: o auditor escreve `"As portas de vidro [...]
 * deverão receber sinalização"` — corta o meio de propósito, para caber.
 * Procurar a corrida inteira atravessa o `[...]` e não acha nada. Cada pedaço é
 * procurado por si; o trecho ancora quando TODOS ancoram.
 */
function pedacosDe(trecho: string): string[] {
  return trecho
    .split(/\[\s*\.\.\.\s*\]|\[…\]|…|\.\.\./)
    .map((p) => esqueleto(p).slice(0, 60))
    .filter((p) => p.length >= 12);
}

export function ancorarTrecho(
  indice: IndiceDeAncoragem,
  trecho: string,
  paginasDeclaradas: readonly number[],
): Veredito {
  const pedacos = pedacosDe(trecho);
  if (pedacos.length === 0) return "sem_transcricao";

  /*
   * As páginas declaradas viram UM texto só: frase de memorial atravessa a
   * virada de página o tempo todo, e conferindo página a página isoladamente
   * uma transcrição correta de p.61-62 não ancoraria em nenhuma das duas.
   */
  const textoDeclarado = paginasDeclaradas.map((p) => indice.porPagina.get(p) ?? "").join("");
  if (pedacos.every((pedaco) => textoDeclarado.includes(pedaco))) return "ancorada";
  if (pedacos.every((pedaco) => indice.documentoInteiro.includes(pedaco))) return "outra_pagina";
  return "nao_encontrada";
}

export function ancorarEvidencia(
  indice: IndiceDeAncoragem,
  evidencia: string,
  pagina: unknown,
): { veredito: Veredito; trecho: string } {
  const trechos = trechosCitados(evidencia);
  if (trechos.length === 0) return { veredito: "sem_transcricao", trecho: "" };

  const paginas = paginasDe(pagina);
  let melhor: Veredito = "nao_encontrada";
  let qual = trechos[0];

  for (const trecho of trechos) {
    const v = ancorarTrecho(indice, trecho, paginas);
    if (v === "ancorada") return { veredito: "ancorada", trecho };
    if (v === "outra_pagina" && melhor === "nao_encontrada") {
      melhor = "outra_pagina";
      qual = trecho;
    }
  }

  return { veredito: melhor, trecho: qual };
}
