/**
 * CONFERÊNCIA DO VOLUME MONTADO — núcleo puro.
 *
 * O portão final. As outras duas conferências olham os SELOS LIDOS, antes da
 * montagem; esta abre o PDF que vai ser enviado e o confere contra o plano que
 * o gerou.
 *
 * A divisão de trabalho é a mesma do resto do sistema, e é o ponto do módulo:
 *
 *   a IA lê, a regra julga.
 *
 * O modelo devolve o que enxerga no carimbo de cada página e nada mais. Comparar
 * com o gabarito é código determinístico, aqui, testável em node cru. Um modelo
 * que erra a leitura produz um achado errado, que se vê e se corrige; um modelo
 * que erra o veredito produz um volume aprovado no escuro.
 *
 * A SEVERIDADE segue de quem afirma o quê. A estrutura (contagem, papel) é
 * aritmética sobre o plano e não passa pelo modelo — crítico ali é confiável.
 * O conteúdo passa pela leitura, e leitura erra: divergência isolada é aviso, e
 * só o padrão SISTEMÁTICO sobe para crítico. Um crítico falso ensina a ignorar
 * o semáforo, que é o pior estrago que uma conferência pode fazer.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 */

export type Severidade = "critico" | "aviso" | "info";
export type Veredito = "ok" | "aviso" | "critico";

/** Espelha `LightCheckFinding` de `light-check-core.ts`. Redeclarado: núcleo puro. */
export interface Achado {
  severidade: Severidade;
  campo: string;
  mensagem: string;
  detalhe?: string;
}

/** Uma linha da LD como ela foi IMPRESSA dentro do volume. */
export interface LinhaDaLdImpressa {
  sheet: string;
  file: string;
  description: string;
}

/** O que se leu de UMA página do PDF montado. Leitura, não juízo. */
export interface LeituraDaPagina {
  pagina: number;
  /** A página tem carimbo de prancha? Vem da contagem de âncoras, não do modelo. */
  temCarimbo: boolean;
  numeracaoTexto: string;
  folha: number | null;
  total: number | null;
  codigo: string;
  titulo: string;
  disciplina: string;
  orgao: string;
  obra: string;
  /** Só em página de LD: as linhas lidas por extração de texto. */
  linhasDaLd?: LinhaDaLdImpressa[];
  /** A página não pôde ser lida. Impede o veredito "ok". */
  erro?: string;
}

/** Contra o que se confere. */
export interface AlvoDoVolume {
  /** A prefeitura DECLARADA — a da capa. Nunca inferida do próprio selo. */
  orgao: string;
  /** O `pageCount` que a montagem devolveu para o PDF final. */
  pageCount: number;
}

export interface VolumeCheckResult {
  veredito: Veredito;
  findings: Achado[];
  /** Quantas páginas entraram no juízo — a UI diz sobre o que ele fala. */
  paginasConferidas: number;
}

/** Redeclarado de `volume-plano.ts`: núcleo puro não importa. */
export interface PaginaEsperada {
  pagina: number;
  papel: "capa" | "separatriz" | "ld" | "prancha";
  bloco: string;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
}

const RANK: Record<Veredito, number> = { ok: 0, aviso: 1, critico: 2 };

/** Lista curta e legível (a mensagem não pode estourar com 200 páginas). */
function juntar(itens: string[], max = 6): string {
  if (itens.length <= max) return itens.join(", ");
  return `${itens.slice(0, max).join(", ")} (+${itens.length - max})`;
}

export function checkVolumeMontado(
  esperado: readonly PaginaEsperada[],
  lido: readonly LeituraDaPagina[],
  alvo: AlvoDoVolume,
): VolumeCheckResult {
  const findings: Achado[] = [];
  const porPagina = new Map(lido.map((l) => [l.pagina, l]));

  // --- Estrutura: a contagem (CRÍTICO) ---------------------------------------
  if (esperado.length > 0 && alvo.pageCount !== esperado.length) {
    findings.push({
      severidade: "critico",
      campo: "paginas",
      mensagem: `O volume saiu com ${alvo.pageCount} página(s); o plano previa ${esperado.length}.`,
      detalhe:
        "A fusão comeu ou duplicou páginas — o PDF não corresponde às partes que foram montadas.",
    });
  }

  /*
   * --- Estrutura: papel trocado (CRÍTICO) ----------------------------------
   *
   * A prova é a presença do CARIMBO, que vem da contagem de âncoras e não de uma
   * leitura de papel pelo modelo (o modelo não devolve papel). A ordem canônica
   * em si não é reconferida: ela sai de `buildVolumeParts`, que é puro e já
   * travado por `test:nexo:parts`. O que pode dar errado da montagem para o PDF
   * é a FAIXA de páginas de cada parte, e é isso que estas duas regras pegam.
   */
  const semCarimbo: string[] = [];
  const carimboAMais: string[] = [];
  for (const p of esperado) {
    const l = porPagina.get(p.pagina);
    // Página não lida não prova nada; acusar seria inventar defeito.
    if (!l || l.erro) continue;
    if (p.papel === "prancha" && !l.temCarimbo) semCarimbo.push(`p.${p.pagina}`);
    if (p.papel !== "prancha" && l.temCarimbo) {
      carimboAMais.push(`p.${p.pagina} (devia ser ${p.papel})`);
    }
  }
  if (semCarimbo.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${semCarimbo.length} página(s) deveriam ser prancha e não têm carimbo.`,
      detalhe: `${juntar(semCarimbo)} — a faixa recortada trouxe capa ou índice para dentro do bloco.`,
    });
  }
  if (carimboAMais.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${carimboAMais.length} página(s) trazem carimbo de prancha onde deveria haver outra parte.`,
      detalhe: juntar(carimboAMais),
    });
  }

  let veredito: Veredito = "ok";
  for (const f of findings) {
    const como: Veredito =
      f.severidade === "critico" ? "critico" : f.severidade === "aviso" ? "aviso" : "ok";
    if (RANK[como] > RANK[veredito]) veredito = como;
  }

  return { veredito, findings, paginasConferidas: lido.length };
}
