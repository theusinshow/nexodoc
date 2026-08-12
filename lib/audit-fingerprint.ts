/**
 * A IMPRESSÃO DIGITAL DO MEMORIAL, capítulo a capítulo.
 *
 * Existe para responder a uma pergunta que hoje ninguém sabe responder: entre
 * esta revisão do memorial e a que já foi auditada, O QUE MUDOU? Sem isso, um
 * memorial que ganhou o volume do metálico é reauditado inteiro — o documento
 * do 063-26 tem 173 mil caracteres, e no nível profundo eles vão TODOS numa
 * chamada só, medida em 258s.
 *
 * NÃO é cache de leitura de IA (isso é a etapa seguinte, e depende disto ser
 * confiável primeiro). Aqui só se compara texto e se diz o que mudou.
 *
 * O QUE IDENTIFICA UM CAPÍTULO, e por que não o `id`:
 * `chunkPdfByChapter` numera os blocos por posição (`chunk-1`, `chunk-2`…), e
 * inserir um capítulo no meio renumera todos os seguintes. Página também anda.
 * O que não anda é o CONTEÚDO — por isso o casamento é por hash primeiro, e por
 * título só para o que sobrou.
 */
import { createHash } from "node:crypto";

import type { AuditTextChunk } from "./pdf-text";
// O TIPO mora no relatório (que o navegador lê); o CÁLCULO mora aqui, com o
// `node:crypto` que só existe no servidor.
import type { CapituloImpresso } from "./audit-report";

export type { CapituloImpresso };

export interface CapituloAlterado {
  antes: CapituloImpresso;
  agora: CapituloImpresso;
}

export interface DeltaDeCapitulos {
  iguais: CapituloImpresso[];
  alterados: CapituloAlterado[];
  novos: CapituloImpresso[];
  sumidos: CapituloImpresso[];
}

/**
 * Normalização MÍNIMA antes do hash: espaço colapsado e bordas aparadas.
 *
 * Nada de minúsculas nem de tirar acento: no memorial, "CONCRETO FCK 25 MPa"
 * virar "concreto fck 25 mpa" apagaria a diferença entre um trecho reescrito e
 * o mesmo trecho — e é justamente essa diferença que decide se o capítulo vai
 * de novo ao modelo. Aqui, falso "igual" custa uma auditoria que não enxerga o
 * que mudou; falso "diferente" custa só dinheiro.
 */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function hashDoTexto(texto: string): string {
  return createHash("sha256").update(normalizar(texto), "utf8").digest("hex");
}

/** Título comparável: caixa e acento não distinguem capítulo. */
function chaveDoTitulo(titulo: string): string {
  return normalizar(titulo)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function impressaoDosCapitulos(
  chunks: readonly AuditTextChunk[],
): CapituloImpresso[] {
  return chunks.map((c) => ({
    titulo: c.title ?? "",
    startPage: c.startPage,
    endPage: c.endPage,
    chars: normalizar(c.text).length,
    hash: hashDoTexto(c.text),
  }));
}

/**
 * O que mudou entre duas impressões. Ordem de casamento:
 *
 * 1. HASH — conteúdo idêntico é o mesmo capítulo, tenha ele mudado de página ou
 *    de posição. É o caso comum de "inseriram um capítulo no meio".
 * 2. TÍTULO — sobrou dos dois lados com o mesmo título: é o mesmo capítulo,
 *    reescrito. Vira `alterado`.
 * 3. O resto: o que sobrou de agora é novo; o que sobrou de antes sumiu.
 *
 * Capítulo sem título (PDF onde a regex não achou cabeçalho) só casa por hash —
 * e cai em novo/sumido quando o texto muda. É o conservador certo: no pior caso
 * ele é reenviado ao modelo, e o pior caso aqui é gastar, não deixar de ver.
 */
export function compararImpressoes(
  antes: readonly CapituloImpresso[],
  agora: readonly CapituloImpresso[],
): DeltaDeCapitulos {
  const sobrouAntes = [...antes];
  const sobrouAgora = [...agora];
  const iguais: CapituloImpresso[] = [];
  const alterados: CapituloAlterado[] = [];

  // 1. Por hash.
  for (let i = sobrouAgora.length - 1; i >= 0; i--) {
    const j = sobrouAntes.findIndex((a) => a.hash === sobrouAgora[i].hash);
    if (j === -1) continue;
    iguais.unshift(sobrouAgora[i]);
    sobrouAntes.splice(j, 1);
    sobrouAgora.splice(i, 1);
  }

  // 2. Por título, entre os que sobraram.
  for (let i = sobrouAgora.length - 1; i >= 0; i--) {
    const chave = chaveDoTitulo(sobrouAgora[i].titulo);
    if (!chave) continue;
    const j = sobrouAntes.findIndex((a) => chaveDoTitulo(a.titulo) === chave);
    if (j === -1) continue;
    alterados.unshift({ antes: sobrouAntes[j], agora: sobrouAgora[i] });
    sobrouAntes.splice(j, 1);
    sobrouAgora.splice(i, 1);
  }

  return { iguais, alterados, novos: sobrouAgora, sumidos: sobrouAntes };
}

/** Quanto do documento novo já foi lido antes, em caracteres (0 a 1). */
export function fracaoJaLida(delta: DeltaDeCapitulos): number {
  const iguais = delta.iguais.reduce((n, c) => n + c.chars, 0);
  const total =
    iguais +
    delta.alterados.reduce((n, c) => n + c.agora.chars, 0) +
    delta.novos.reduce((n, c) => n + c.chars, 0);
  return total === 0 ? 0 : iguais / total;
}

/** Uma frase para a tela: o que mudou, sem adjetivo. */
export function resumoDoDelta(delta: DeltaDeCapitulos): string {
  const partes: string[] = [];
  if (delta.iguais.length > 0) partes.push(`${delta.iguais.length} igual(is)`);
  if (delta.alterados.length > 0) partes.push(`${delta.alterados.length} alterado(s)`);
  if (delta.novos.length > 0) partes.push(`${delta.novos.length} novo(s)`);
  if (delta.sumidos.length > 0) partes.push(`${delta.sumidos.length} removido(s)`);
  return partes.length > 0 ? partes.join(", ") : "nenhum capítulo reconhecido";
}
