/**
 * Normalização PURA da saída do agente Nexo (sem imports de runtime — só type),
 * para ser testável com node cru (`test:nexo:agent`). Converte o JSON cru do
 * modelo em NexoAgentProposal[] confiável: mapeia a prefeitura (tolerante a
 * acento/variação), preenche defaults e limita valores. O run-turn.ts consome.
 */
import type { NexoAgentProposal } from "@/modules/nexo/types";

export interface AgentPrefeitura {
  id: string;
  nome: string;
}

export interface NormalizeContext {
  disciplina: string;
  prefeituras: AgentPrefeitura[];
}

/** minúsculas + sem acento + espaço colapsado. */
function norm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Número de tomos (divide em N): default 1, limite 99. */
export function clampTomos(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

/**
 * Mapeia o que o modelo pediu (id direto OU nome da prefeitura, possivelmente com
 * acento faltando ou verboso como "prefeitura de chapecó") para um template real.
 * Ordem: id exato -> contém/está-contido -> token da cidade (>=3 letras). null se
 * não casar.
 */
export function matchPrefeitura(
  wanted: { id?: string; nome?: string },
  prefeituras: AgentPrefeitura[],
): AgentPrefeitura | null {
  const wantedId = (wanted.id ?? "").trim();
  if (wantedId) {
    const byId = prefeituras.find((t) => t.id === wantedId);
    if (byId) return byId;
  }
  const w = norm(wanted.nome ?? "");
  if (!w) return null;

  // 1) o nome do template contém o pedido, ou o pedido contém o nome.
  for (const t of prefeituras) {
    const tn = norm(t.nome);
    if (tn && (tn.includes(w) || w.includes(tn))) return t;
  }
  // 2) algum token da cidade (>=3 letras) aparece no pedido.
  for (const t of prefeituras) {
    const tokens = norm(t.nome).split(/[^a-z0-9]+/).filter((x) => x.length >= 3);
    if (tokens.some((tok) => w.includes(tok))) return t;
  }
  return null;
}

/** Nível da auditoria: só "deep" é preservado; qualquer outra coisa → "standard". */
function clampNivel(v: unknown): "standard" | "deep" {
  return String(v ?? "").trim().toLowerCase() === "deep" ? "deep" : "standard";
}

/**
 * Normaliza `proposals` cru do modelo. `raw` pode ser qualquer coisa; retorna só
 * propostas válidas, com prefeitura mapeada e defaults aplicados. Kinds cobertos:
 * ld | capa (INTOCADOS) + separatriz | auditoria | conferencia | volume (PR4,
 * aditivo). Kinds desconhecidos são ignorados (degrada gracioso).
 */
export function normalizeProposals(
  raw: unknown,
  ctx: NormalizeContext,
): NexoAgentProposal[] {
  if (!Array.isArray(raw)) return [];
  const firstTemplateId = ctx.prefeituras[0]?.id ?? "";
  const out: NexoAgentProposal[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;

    if (p.kind === "ld") {
      out.push({
        kind: "ld",
        resumo: String(p.resumo ?? "").trim() || `LD ${ctx.disciplina}`,
        params: {
          // Título é decisão do engenheiro: nunca adivinhar (fica vazio).
          tituloLd: String(p.tituloLd ?? "").trim(),
          numTomos: clampTomos(p.numTomos),
        },
      });
    } else if (p.kind === "capa") {
      const match = matchPrefeitura(
        { id: String(p.templateId ?? ""), nome: String(p.prefeitura ?? "") },
        ctx.prefeituras,
      );
      const templateId = match?.id ?? (String(p.templateId ?? "").trim() || firstTemplateId);
      if (!templateId) continue; // sem prefeitura configurada, não propõe capa
      const volumeRaw = String(p.volume ?? "").trim();
      out.push({
        kind: "capa",
        resumo:
          String(p.resumo ?? "").trim() || `Capa ${match?.nome ?? ctx.disciplina}`,
        params: {
          templateId,
          // só dígitos; senão "" (deriva do nome do arquivo no builder)
          volume: /^\d+$/.test(volumeRaw) ? volumeRaw : "",
          numTomos: clampTomos(p.numTomos),
        },
      });
    } else if (p.kind === "separatriz") {
      // Mesma lógica de prefeitura/tomos da capa (reuso de matchPrefeitura/clampTomos).
      const match = matchPrefeitura(
        { id: String(p.templateId ?? ""), nome: String(p.prefeitura ?? "") },
        ctx.prefeituras,
      );
      const templateId = match?.id ?? (String(p.templateId ?? "").trim() || firstTemplateId);
      if (!templateId) continue; // sem prefeitura configurada, não propõe separatriz
      out.push({
        kind: "separatriz",
        resumo:
          String(p.resumo ?? "").trim() || `Separatriz ${match?.nome ?? ctx.disciplina}`,
        params: {
          templateId,
          numTomos: clampTomos(p.numTomos),
        },
      });
    } else if (p.kind === "auditoria") {
      out.push({
        kind: "auditoria",
        resumo: String(p.resumo ?? "").trim() || `Auditoria ${ctx.disciplina}`,
        params: {
          // "deep" preservado; ausente/"xyz" → "standard".
          nivel: clampNivel(p.nivel),
        },
      });
    } else if (p.kind === "conferencia") {
      // Sem decisão editável do usuário na v1: params vazio.
      out.push({
        kind: "conferencia",
        resumo: String(p.resumo ?? "").trim() || `Conferência ${ctx.disciplina}`,
        params: {},
      });
    } else if (p.kind === "volume") {
      // Sem decisão editável do usuário na v1: params vazio.
      out.push({
        kind: "volume",
        resumo: String(p.resumo ?? "").trim() || `Volume ${ctx.disciplina}`,
        params: {},
      });
    }
  }
  return out;
}
