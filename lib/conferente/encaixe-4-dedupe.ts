/**
 * ENCAIXE 4 — "estes dois relatos são o mesmo defeito?"
 *
 * O QUE A IMPRESSÃO DIGITAL NÃO ALCANÇA
 *
 * `impressao-do-achado.ts` casa achado por arquivo + páginas + trecho citado +
 * números do trecho. A medição está escrita lá: a chave antiga rendia 7% de
 * estabilidade entre duas corridas do MESMO documento, e a atual rende 50% — e
 * as chaves que rendiam mais fundiam defeitos distintos, por isso foram
 * recusadas.
 *
 * Sobram ~50% de achados que reaparecem como novos na reauditoria. Eles não
 * casam porque o modelo cita um pedaço diferente da mesma frase, ou porque a
 * quebra de linha do PDF caiu noutro lugar. É uma decisão de LINGUAGEM sobre um
 * estado de duas frases — exatamente o formato desta camada.
 *
 * ADITIVO, E A DÚVIDA MANTÉM OS DOIS
 *
 * Fundir dois achados distintos é pior do que listar o mesmo defeito duas
 * vezes: o segundo é ruído que o engenheiro descarta em dois segundos, o
 * primeiro é um achado que sumiu. Por isso o corte é alto e o empate mantém os
 * dois — que é, não por acaso, o comportamento de hoje.
 *
 * O PAR SÓ É PERGUNTADO QUANDO JÁ ESTÁ PERTO
 *
 * `n` achados dão `n²/2` pares, e 56 achados dariam 1.540 perguntas. A
 * pré-filtragem determinística (mesmo arquivo, páginas que se tocam) derruba
 * isso para dezenas, e é de graça. O conferente só é chamado onde a impressão
 * digital chegou perto e não fechou.
 */

import type { AuditFinding } from "@/lib/audit-report";

import { perguntarAoConferente, type Pergunta, type RespostaNoul } from "./jev";

const PERGUNTAS: Record<string, Pergunta> = {
  same_defect: {
    type: "noul",
    instructions:
      "Do the two reports below describe the SAME defect in the same document, rather than two different defects?",
    criteria: {
      true: "Both point at the same passage and the same problem, even if they quote different fragments of it or word the conflict differently.",
      false: "They are different defects, even when they sit on the same page or in the same section: a different passage, a different quantity, or a different kind of problem.",
    },
  },
  same_passage: {
    type: "noul",
    instructions: "Do the two quoted excerpts come from the same sentence or the same table row?",
    criteria: {
      true: "One quote is contained in the other, or both quote overlapping parts of one sentence or row.",
      false: "They quote different sentences or different rows.",
    },
  },
};

/**
 * O corte é 0,85, e é o mais alto dos quatro encaixes.
 *
 * Aqui o erro tem lado caro: fundir apaga um achado, e apagar achado é a única
 * coisa que este projeto decidiu, em agosto/2026, nunca mais fazer por
 * conveniência. Exigir as DUAS perguntas altas é a segunda trava: "é o mesmo
 * defeito" sozinho responde alto para dois defeitos parecidos na mesma seção.
 */
const CORTE = 0.85;

function ehNoul(valor: unknown): valor is RespostaNoul {
  return Boolean(valor) && (valor as RespostaNoul).type === "noul";
}

function paginas(finding: AuditFinding): number[] {
  return String(finding.pagina ?? "")
    .split(/[^\d]+/)
    .map((pedaco) => Number.parseInt(pedaco, 10))
    .filter((numero) => Number.isFinite(numero));
}

/**
 * O par vale a pergunta? Filtro DETERMINÍSTICO e de graça.
 *
 * Mesmo arquivo e páginas que se tocam (a mesma ou vizinha). Defeito que o
 * modelo relatou duas vezes fica na mesma página ou atravessa a quebra; dois
 * relatos a 40 páginas de distância não são o mesmo defeito, e perguntar sobre
 * eles seria pagar por 1.500 respostas para achar meia dúzia.
 */
export function parValeAPergunta(a: AuditFinding, b: AuditFinding) {
  if ((a.arquivo ?? "") !== (b.arquivo ?? "")) {
    return false;
  }

  const pa = paginas(a);
  const pb = paginas(b);

  if (pa.length === 0 || pb.length === 0) {
    return false;
  }

  return pa.some((umA) => pb.some((umB) => Math.abs(umA - umB) <= 1));
}

export type ParDuplicado = { manter: string; duplicado: string; probabilidade: number };

function estadoDoPar(a: AuditFinding, b: AuditFinding) {
  const relato = (finding: AuditFinding, rotulo: string) =>
    [
      `--- ${rotulo} ---`,
      `Tipo: ${finding.tipo}`,
      `Página: ${finding.pagina}`,
      `Trecho citado: ${finding.evidencia}`,
      `Conflito: ${finding.conflito}`,
    ].join("\n");

  return `${relato(a, "RELATO A")}\n\n${relato(b, "RELATO B")}`;
}

/**
 * Os pares que o conferente diz serem o mesmo defeito.
 *
 * NÃO REMOVE NADA: devolve a lista, e quem chama decide. O segundo do par é o
 * marcado como duplicado porque `dedupeFindings` já segue a regra "quem chega
 * primeiro fica", e mudar essa escolha merece medição própria.
 */
export async function acharDuplicadosPareados(
  findings: AuditFinding[],
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<ParDuplicado[]> {
  const pares: Array<[AuditFinding, AuditFinding]> = [];

  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      if (parValeAPergunta(findings[i], findings[j])) {
        pares.push([findings[i], findings[j]]);
      }
    }
  }

  /*
   * TETO DE PARES, e não é do fornecedor: é para um documento patológico não
   * transformar uma camada opcional em espera. 200 pares a ~700 tokens de
   * entrada é US$ 0,006 e cabe nos 1.200 req/min com folga.
   */
  const TETO = 200;
  const fila = pares.slice(0, TETO);
  const duplicados: ParDuplicado[] = [];
  const LARGURA = 8;

  for (let inicio = 0; inicio < fila.length; inicio += LARGURA) {
    const lote = fila.slice(inicio, inicio + LARGURA);
    const respostas = await Promise.all(
      lote.map(async ([a, b]) => {
        const resposta = await perguntarAoConferente({
          estado: estadoDoPar(a, b),
          perguntas: PERGUNTAS,
          operacao: "conferente-dedupe",
          userEmail: contexto?.userEmail,
          conversationId: contexto?.conversationId,
        });

        if (!resposta) {
          return null;
        }

        const mesmo = resposta.respostas.same_defect;
        const trecho = resposta.respostas.same_passage;

        if (!ehNoul(mesmo) || !ehNoul(trecho)) {
          return null;
        }

        if (mesmo.noul < CORTE || trecho.noul < CORTE) {
          return null;
        }

        return { manter: a.id, duplicado: b.id, probabilidade: mesmo.noul };
      }),
    );

    for (const par of respostas) {
      if (par) {
        duplicados.push(par);
      }
    }
  }

  return duplicados;
}
