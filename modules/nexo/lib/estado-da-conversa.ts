/**
 * COMO A CONVERSA TERMINOU — a segunda linha de cada conversa no histórico
 * (desenho do lab: Histórico de conversas, 02/10/2026).
 *
 * A barra dizia "AUDITORIA" ou "LD CAPA SEP VOL" e mais nada: para saber se a
 * auditoria de ontem bloqueou a emissão, era preciso abri-la. Aqui o resumo do
 * servidor vira um estado só, com o veredito e quanto falta tratar, ou o que o
 * volume gerou e de que disciplinas.
 *
 * O VEREDITO SAI DO RESUMO CURTO que toda auditoria grava junto do resultado
 * (`resumoDoParecer`: "Auditoria — <status geral>"), e não do parecer inteiro:
 * o resumo existe desde sempre e cabe numa coluna do SELECT; o parecer são
 * centenas de KB por conversa.
 *
 * PURO e sem imports → roda em node cru (`npm run test:nexo:cartoes`).
 */

export type VereditoDaConversa = "nao-emitir" | "revisar" | "liberado" | "parcial";

export type EstadoDaConversa =
  | { tipo: "auditando" }
  | { tipo: "auditoria"; veredito: VereditoDaConversa | null; aTratar: number | null; total: number | null }
  | { tipo: "volume"; tomos: number; folhas: number; disciplinas: string[] }
  | { tipo: "documentos"; capas: number; lds: number; separatrizes: number; folhas: number; disciplinas: string[] }
  | { tipo: "leitura"; folhas: number; disciplinas: string[] }
  | { tipo: "conversa"; memorialSemAuditoria?: boolean };

/** O que o estado precisa do resumo da conversa (`ConversaResumida`). */
export interface FatosDoEstado {
  folhas: number;
  kinds: readonly string[];
  auditoriaPendente?: boolean;
  auditoriaResumo?: string | null;
  auditoriaTotal?: number | null;
  auditoriaTratados?: number | null;
  capas?: number;
  lds?: number;
  separatrizes?: number;
  volumes?: number;
  disciplinas?: readonly string[];
  /** A seção da conversa (`tipo-de-trabalho.ts`): "auditoria" já com o memorial anexado. */
  tipo?: string | null;
}

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "Auditoria — com inconsistências críticas" → não emitir. São os textos de
 * `status_geral` (lib/audit-report.ts) e o título da auditoria incompleta.
 * Desconhecido → null: a tela diz "Auditoria" sem inventar um veredito.
 */
export function vereditoDoResumo(resumo: string | null | undefined): VereditoDaConversa | null {
  const t = semAcento(resumo ?? "");
  if (!t) return null;
  if (t.includes("incompleta") || t.includes("parcial")) return "parcial";
  if (t.includes("criticas") && !t.includes("sem achados criticos")) return "nao-emitir";
  if (t.includes("obrigatoria")) return "nao-emitir";
  if (t.includes("pontos de revisao")) return "revisar";
  if (t.includes("sem achados criticos")) return "liberado";
  return null;
}

export function estadoDaConversa(c: FatosDoEstado): EstadoDaConversa {
  const tem = new Set(c.kinds.map((k) => k.trim().toLowerCase()));
  const disciplinas = [...(c.disciplinas ?? [])];
  if (c.auditoriaPendente) return { tipo: "auditando" };
  if (tem.has("auditoria")) {
    const total = c.auditoriaTotal ?? null;
    const tratados = c.auditoriaTratados ?? null;
    return {
      tipo: "auditoria",
      veredito: vereditoDoResumo(c.auditoriaResumo),
      total,
      aTratar: total !== null && tratados !== null ? Math.max(0, total - tratados) : null,
    };
  }
  if (tem.has("volume")) return { tipo: "volume", tomos: Math.max(1, c.volumes ?? 1), folhas: c.folhas, disciplinas };
  if (tem.has("capa") || tem.has("ld") || tem.has("separatriz")) {
    return {
      tipo: "documentos",
      capas: c.capas ?? (tem.has("capa") ? 1 : 0),
      lds: c.lds ?? (tem.has("ld") ? 1 : 0),
      separatrizes: c.separatrizes ?? (tem.has("separatriz") ? 1 : 0),
      folhas: c.folhas,
      disciplinas,
    };
  }
  if (c.folhas > 0) return { tipo: "leitura", folhas: c.folhas, disciplinas };
  /*
   * Memorial anexado e auditoria nunca rodada: era "sem tarefa", e a tarefa
   * estava lá — só faltava rodar (07/10/2026).
   */
  if (c.tipo === "auditoria") return { tipo: "conversa", memorialSemAuditoria: true };
  return { tipo: "conversa" };
}

/** "Capa, 3 LDs e 3 separatrizes" — cada documento contado, sem os que não há. */
export function oQueFoiGerado(e: { capas: number; lds: number; separatrizes: number }): string {
  const conta = (n: number, um: string, varios: string) => (n === 1 ? um : `${n} ${varios}`);
  const partes = [
    e.capas > 0 && conta(e.capas, "capa", "capas"),
    e.lds > 0 && conta(e.lds, "LD", "LDs"),
    e.separatrizes > 0 && conta(e.separatrizes, "separatriz", "separatrizes"),
  ].filter(Boolean) as string[];
  const frase = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : (partes[0] ?? "");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * Projeto de exemplo ou de teste: o projeto guiado, a "Cidade Fictícia" das
 * provas e as simulações da bateria (SIM…). Vão para o grupo recolhido do fim.
 */
export function ehDeExemplo(codigo: string, cliente: string): boolean {
  return /^sim\d/i.test(codigo.trim()) || /fict[ií]cia/i.test(cliente) || /exemplo/i.test(codigo);
}

/**
 * As conversas FICTÍCIAS que o próprio Nexo semeia: a do tour e a do memorial
 * de exemplo (`projeto-exemplo.ts`). O código delas é de obra comum (042-26,
 * Criciúma), então só o id as distingue — e sem isso o exemplo aparecia na
 * barra como uma pasta de Criciúma de verdade (10/10/2026).
 */
export function ehConversaDeExemplo(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("nexo-exemplo-");
}
