/**
 * AS FERRAMENTAS DO ADVOGADO DO DIABO — todas determinísticas.
 *
 * O princípio é o do resto do produto: fato determinístico primeiro, IA por
 * último. A IA escolhe O QUE olhar; quem responde ONDE ESTÁ é o código. É isso
 * que torna a afirmação do chat verificável, e é a única razão de "achado novo
 * nascido na conversa" poder entrar no parecer com prova que sustenta.
 *
 * Nenhuma função aqui toca banco, rede ou modelo. Todas são testáveis em Node
 * cru — como `server/nexo/agent/fatos.ts` já é. Por isso os imports são
 * relativos e com extensão.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import {
  ancorarEvidencia,
  esqueleto,
  esqueletoComMapa,
  indexarParaAncoragem,
  paginasDe,
  type IndiceDeAncoragem,
  type Veredito,
} from "../../../lib/ancoragem-de-evidencia.ts";
import type {
  AuditFinding,
  AuditReport,
  FindingImpact,
  FindingPriority,
} from "../../../lib/audit-report.ts";
import { impressaoDoAchado } from "../../../lib/impressao-do-achado.ts";
import type { MemoriaDoDocumento } from "../../../lib/memoria-do-documento.ts";

/**
 * Quantas páginas uma chamada de `ler_paginas` entrega.
 *
 * Seis, e não "o que ele pedir": o memorial de 73 páginas tem 173k chars, e um
 * pedido de 1 a 73 devolveria o documento inteiro por ferramenta — que é
 * exatamente o contexto cheio que a spec recusou, entrando pela porta dos
 * fundos e em TODA volta do laço.
 */
export const TETO_DE_PAGINAS_POR_LEITURA = 6;

/** Quantas ocorrências uma busca devolve antes de dizer que há mais. */
const TETO_DE_OCORRENCIAS = 8;

/** Caracteres de contexto ao redor da ocorrência, de cada lado. */
const JANELA = 260;

export type ContextoDoChat = {
  report: AuditReport;
  memorias: MemoriaDoDocumento[];
  /** Um índice de ancoragem por arquivo, montado uma vez por turno. */
  indices: Map<string, IndiceDeAncoragem>;
};

export function montarContexto(
  report: AuditReport,
  memorias: MemoriaDoDocumento[],
): ContextoDoChat {
  const indices = new Map<string, IndiceDeAncoragem>();
  for (const m of memorias) {
    indices.set(m.fileName, indexarParaAncoragem(m.paginas));
  }
  return { report, memorias, indices };
}

/** Falso = parecer antigo, gravado antes de a memória do documento existir. */
export function temMemoria(ctx: ContextoDoChat): boolean {
  return ctx.memorias.some((m) => m.paginas.length > 0);
}

const SEM_TEXTO =
  "Esta auditoria foi gravada antes de o texto do memorial passar a ser guardado. " +
  "Não há documento para reler: responda apenas com o parecer e DIGA ao engenheiro " +
  "que não tem o documento desta auditoria, sugerindo reauditar para habilitar a releitura.";

export function listarCapitulos(ctx: ContextoDoChat): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const linhas: string[] = [];
  for (const m of ctx.memorias) {
    const paginas = m.paginas.map((p) => p.page);
    linhas.push(
      `Arquivo: ${m.fileName} — ${m.paginas.length} páginas (${Math.min(...paginas)} a ${Math.max(
        ...paginas,
      )}), ${m.charCount} chars`,
    );
    for (const c of m.capitulos) {
      linhas.push(`  ${c.title} | páginas ${c.startPage}-${c.endPage} | ${c.chars} chars`);
    }
  }
  return linhas.join("\n");
}

export function buscarNoMemorial(
  ctx: ContextoDoChat,
  termo: string,
  limite = TETO_DE_OCORRENCIAS,
): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const alvo = esqueleto(termo);
  if (alvo.length < 3) {
    return "Termo curto demais para buscar. Use pelo menos 3 caracteres alfanuméricos.";
  }

  const achados: string[] = [];
  let total = 0;

  for (const m of ctx.memorias) {
    for (const pagina of m.paginas) {
      const { skeleton, indices } = esqueletoComMapa(pagina.text);
      let de = skeleton.indexOf(alvo);
      while (de !== -1) {
        total += 1;
        if (achados.length < limite) {
          // O recorte sai do texto ORIGINAL, com acento e pontuação: é o que o
          // engenheiro vai encontrar quando abrir o PDF para conferir.
          const inicio = Math.max(0, (indices[de] ?? 0) - JANELA);
          const fim = Math.min(pagina.text.length, (indices[de + alvo.length - 1] ?? 0) + JANELA);
          const trecho = pagina.text.slice(inicio, fim).replace(/\s+/g, " ").trim();
          achados.push(`${m.fileName} · página ${pagina.page}:\n  ...${trecho}...`);
        }
        de = skeleton.indexOf(alvo, de + 1);
      }
    }
  }

  if (total === 0) {
    /*
     * NÃO APROXIMAR. A tentação é devolver "o mais parecido", e ela é o defeito:
     * o modelo trataria a aproximação como ocorrência e citaria uma página onde
     * o termo não está. Dizer que não achou é a resposta correta e verificável.
     */
    return `Não encontrado: o termo "${termo}" não aparece no texto extraído de nenhum dos arquivos desta auditoria.`;
  }

  const cabecalho =
    total > achados.length
      ? `${total} ocorrência(s); mostrando as ${achados.length} primeiras. Refine o termo para ver o resto.`
      : `${total} ocorrência(s).`;
  return `${cabecalho}\n\n${achados.join("\n\n")}`;
}

export function lerPaginas(ctx: ContextoDoChat, de: number, ate: number): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const inicio = Math.max(1, Math.min(de, ate));
  const fimPedido = Math.max(de, ate);
  const fim = Math.min(fimPedido, inicio + TETO_DE_PAGINAS_POR_LEITURA - 1);

  const blocos: string[] = [];
  for (const m of ctx.memorias) {
    for (const pagina of m.paginas) {
      if (pagina.page < inicio || pagina.page > fim) continue;
      blocos.push(`--- PAGINA ${pagina.page} (${m.fileName}) ---\n${pagina.text}`);
    }
  }

  if (blocos.length === 0) {
    const todas = ctx.memorias.flatMap((m) => m.paginas.map((p) => p.page));
    const faixa = todas.length ? `${Math.min(...todas)} a ${Math.max(...todas)}` : "nenhuma";
    return `Não existe página ${inicio}-${fim} nesta auditoria. O documento vai da página ${faixa}.`;
  }

  const aviso =
    fimPedido > fim
      ? `\n\n(teto de ${TETO_DE_PAGINAS_POR_LEITURA} páginas por leitura: você pediu até ${fimPedido} e recebeu até ${fim}. Chame de novo a partir da ${fim + 1}.)`
      : "";
  return `${blocos.join("\n\n")}${aviso}`;
}

export function lerAchado(ctx: ContextoDoChat, id: string): string {
  const achados = ctx.report.incongruencias ?? [];
  const alvo = achados.find((f) => f.id === id || esqueleto(f.id) === esqueleto(id));

  if (!alvo) {
    // Listar os ids válidos ENSINA o modelo a se corrigir na volta seguinte,
    // em vez de deixá-lo tentar outro palpite.
    const ids = achados.map((f) => f.id).join(", ") || "(o parecer não tem achados)";
    return `Não existe achado "${id}" neste parecer. IDs disponíveis: ${ids}`;
  }

  return JSON.stringify(alvo as AuditFinding, null, 2);
}

export const FERRAMENTAS_DE_LEITURA: FunctionTool[] = [
  {
    type: "function",
    name: "listar_capitulos",
    description:
      "O índice do memorial auditado: cada capítulo com sua página inicial, final e tamanho. " +
      "Use ANTES de ler páginas, para saber onde procurar.",
    strict: false,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "buscar_no_memorial",
    description:
      "Procura um termo no texto do memorial e devolve as ocorrências com a PÁGINA REAL e o texto ao redor. " +
      "Imune a acento e a espaço. Se não encontrar, diz que não encontrou — nunca aproxima.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        termo: {
          type: "string",
          description: "O que procurar. Mínimo 3 caracteres alfanuméricos.",
        },
      },
      required: ["termo"],
    },
  },
  {
    type: "function",
    name: "ler_paginas",
    description:
      `O texto literal de um intervalo de páginas. Máximo de ${TETO_DE_PAGINAS_POR_LEITURA} páginas por chamada; ` +
      "chame de novo para continuar.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        de: { type: "integer", description: "Primeira página." },
        ate: { type: "integer", description: "Última página." },
      },
      required: ["de", "ate"],
    },
  },
  {
    type: "function",
    name: "ler_achado",
    description: "O achado inteiro do parecer, com todos os campos, pelo id (ex.: INC-003).",
    strict: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "O id do achado." } },
      required: ["id"],
    },
  },
];

export type AchadoProposto = {
  pagina: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  conflito: string;
  sugestao_correcao: string;
  prioridade: FindingPriority;
  impacto: FindingImpact;
  capitulo?: string;
  local?: string;
};

export type ResultadoDoRegistro =
  | { ok: true; achado: AuditFinding; mensagem: string }
  | { ok: false; mensagem: string };

/** O capítulo em vigor na página, tirado do índice guardado. */
function capituloDaPagina(ctx: ContextoDoChat, pagina: number | undefined): string {
  if (pagina === undefined) return "";
  for (const m of ctx.memorias) {
    const c = m.capitulos.find((cap) => pagina >= cap.startPage && pagina <= cap.endPage);
    if (c) return c.title;
  }
  return "";
}

/**
 * O PORTÃO do achado nascido na conversa.
 *
 * Recusar e explicar é melhor que aceitar e avisar: a mensagem de erro volta
 * para o modelo, que corrige e tenta de novo dentro do mesmo turno. Um achado
 * inventado que entra no parecer não tem essa segunda chance — ele passa a ser
 * uma linha que o engenheiro vai levar para a prefeitura.
 *
 * É a ideia de `lib/audit-verify.ts`, só que rodando no ato.
 */
export function registrarAchado(
  ctx: ContextoDoChat,
  proposto: AchadoProposto,
): ResultadoDoRegistro {
  if (!temMemoria(ctx)) {
    return {
      ok: false,
      mensagem:
        "Não há texto guardado desta auditoria, então não dá para conferir a evidência. " +
        "Sem conferência não se grava achado: relate o problema na resposta e sugira reauditar.",
    };
  }

  const faltando = (
    ["pagina", "tipo", "descricao", "evidencia", "conflito", "sugestao_correcao"] as const
  ).filter((campo) => !String(proposto[campo] ?? "").trim());
  if (faltando.length > 0) {
    return { ok: false, mensagem: `Faltam campos obrigatórios: ${faltando.join(", ")}.` };
  }

  /*
   * A ancoragem roda contra o arquivo do achado — ou contra todos, quando a
   * auditoria tem mais de um. Basta ancorar em UM: o achado declara página, e a
   * página pertence a um arquivo só.
   */
  const paginas = paginasDe(proposto.pagina);
  let melhor: { veredito: Veredito; trecho: string } = {
    veredito: "nao_encontrada",
    trecho: "",
  };
  let arquivo = ctx.memorias[0]?.fileName ?? ctx.report.arquivo ?? "";

  for (const memoria of ctx.memorias) {
    const indice = ctx.indices.get(memoria.fileName);
    if (!indice) continue;
    const r = ancorarEvidencia(indice, proposto.evidencia, proposto.pagina);
    if (r.veredito === "ancorada") {
      melhor = r;
      arquivo = memoria.fileName;
      break;
    }
    if (r.veredito !== "nao_encontrada" && melhor.veredito === "nao_encontrada") {
      melhor = r;
      arquivo = memoria.fileName;
    }
  }

  if (melhor.veredito === "sem_transcricao") {
    return {
      ok: false,
      mensagem:
        "A evidência não traz transcrição conferível. Cite entre aspas um trecho LITERAL " +
        "do memorial, com pelo menos 12 caracteres, exatamente como aparece na página.",
    };
  }
  if (melhor.veredito === "outra_pagina") {
    return {
      ok: false,
      mensagem:
        `O trecho existe no documento, mas NÃO na página ${proposto.pagina} — está em outra página. ` +
        "Use `buscar_no_memorial` com esse trecho para descobrir a página certa e registre de novo.",
    };
  }
  if (melhor.veredito !== "ancorada") {
    return {
      ok: false,
      mensagem:
        "O trecho citado não foi encontrado em nenhuma página do documento. " +
        "Não aproxime nem parafraseie: transcreva literalmente do que `ler_paginas` devolveu.",
    };
  }

  const achados = ctx.report.incongruencias ?? [];
  const candidato: AuditFinding = {
    id: `INC-${String(achados.length + 1).padStart(3, "0")}`,
    arquivo,
    prioridade: proposto.prioridade,
    pagina: String(proposto.pagina),
    capitulo: proposto.capitulo ?? capituloDaPagina(ctx, paginas[0]),
    local: proposto.local ?? "",
    tipo: proposto.tipo,
    descricao: proposto.descricao,
    evidencia: proposto.evidencia,
    conflito: proposto.conflito,
    sugestao_correcao: proposto.sugestao_correcao,
    // Nasceu de IA e a evidência ancorou: mesma régua do achado de IA que a
    // trava aprovou.
    confianca: "media",
    origem: "chat",
    impacto: proposto.impacto,
  };

  /*
   * A IMPRESSÃO DIGITAL fecha o portão contra o defeito mais provável: o modelo
   * "descobrindo" na conversa um achado que ele acabou de ler no próprio
   * parecer. Duplicata é pior que achado a menos — o engenheiro trabalha duas
   * vezes a mesma linha e passa a desconfiar da contagem.
   */
  const digital = impressaoDoAchado(candidato);
  const jaExiste = achados.find((f) => impressaoDoAchado(f) === digital);
  if (jaExiste) {
    return {
      ok: false,
      mensagem:
        `Este defeito já está no parecer como ${jaExiste.id} ("${jaExiste.tipo}"). ` +
        "Se a sua leitura for diferente da dele, diga isso na resposta em vez de registrar de novo.",
    };
  }

  return {
    ok: true,
    achado: candidato,
    mensagem: `Achado registrado como ${candidato.id}, com a evidência conferida na página ${candidato.pagina}.`,
  };
}

/**
 * O parecer COM o achado novo. Devolve CÓPIA: quem grava decide quando trocar,
 * e mutar o objeto que a tela está desenhando é como se perde o parecer.
 */
export function aplicarAchadoNoParecer(report: AuditReport, achado: AuditFinding): AuditReport {
  const incongruencias = [...(report.incongruencias ?? []), achado];
  return {
    ...report,
    incongruencias,
    total_incongruencias: incongruencias.length,
  };
}

export const FERRAMENTA_REGISTRAR: FunctionTool = {
  type: "function",
  name: "registrar_achado",
  description:
    "Grava no parecer um problema REAL que você encontrou e que não estava lá. " +
    "A evidência é conferida contra o texto do memorial: se o trecho não existir na página " +
    "informada, a gravação é recusada e você recebe o motivo para corrigir. " +
    "Só use depois de ter lido o trecho com `ler_paginas` ou `buscar_no_memorial`.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      pagina: {
        type: "string",
        description: 'A página onde o problema está. Ex.: "41" ou "41-42".',
      },
      tipo: { type: "string", description: "O defeito, em poucas palavras." },
      descricao: { type: "string", description: "O que está errado e por quê." },
      evidencia: {
        type: "string",
        description:
          "O trecho LITERAL do memorial entre aspas, como aparece na página. Mínimo 12 caracteres.",
      },
      conflito: {
        type: "string",
        description: "Contra o que isso conflita (norma, prancha, outro trecho).",
      },
      sugestao_correcao: { type: "string", description: "O que o engenheiro deve fazer." },
      prioridade: {
        type: "string",
        enum: ["Alta", "Media/Alta", "Media", "Baixa/Media", "Baixa"],
      },
      impacto: {
        type: "string",
        enum: ["critico_documental", "tecnico_contratual", "revisao_editorial"],
        description:
          "A régua do escritório: erro documental crítico, ponto técnico/contratual ou revisão editorial.",
      },
      capitulo: { type: "string", description: "Opcional: sai do índice se você não informar." },
      local: { type: "string", description: "Opcional: o ambiente ou item afetado." },
    },
    required: [
      "pagina",
      "tipo",
      "descricao",
      "evidencia",
      "conflito",
      "sugestao_correcao",
      "prioridade",
      "impacto",
    ],
  },
};
