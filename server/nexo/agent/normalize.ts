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
 * A partir de qual tomo contar: default 1, limite 99. A numeração pertence ao
 * VOLUME — se outra disciplina já ocupou os tomos 01-03, o próximo documento
 * começa no 4 em vez de reiniciar e criar dois "TOMO 01" no mesmo volume.
 */
export function clampTomoInicial(v: unknown): number {
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
/**
 * Palavras que TODA prefeitura tem no nome e por isso não distinguem nenhuma.
 *
 * Sem esta lista, "prefeitura" era token de todas: qualquer texto contendo a
 * palavra casava com a primeira da lista, e no `casarPrefeituraDoCarimbo` — que
 * testa uma a uma — TODAS ficavam plausíveis. `plausibleCount` nunca era 1, o
 * casamento pelo carimbo nunca resolvia, e o palpite silencioso decidia.
 */
const GENERICOS = new Set([
  "prefeitura",
  "municipal",
  "municipio",
  "governo",
  "estado",
  "secretaria",
  "padrao",
]);

/** O texto está NOMEANDO um órgão, ou é só uma frase que cita uma cidade? */
function nomeiaOrgao(w: string): boolean {
  return /\b(prefeitura|municipio|governo)\b/.test(w);
}

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
  /*
   * 2) O NOME DA CIDADE aparece no pedido — e só o nome da cidade, porque as
   * palavras institucionais são de todas.
   *
   * Exige também que o texto NOMEIE UM ÓRGÃO. Um volume de Criciúma saiu como
   * Florianópolis porque o endereço do escritório — "Rua Saldanha Marinho...
   * Centro - Florianópolis - SC" — está impresso nas 71 pranchas, e citar a
   * cidade bastava para casar. Endereço não é cliente.
   */
  if (!nomeiaOrgao(w)) return null;
  for (const t of prefeituras) {
    const cidade = norm(t.nome)
      .split(/[^a-z0-9]+/)
      .filter((x) => x.length >= 3 && !GENERICOS.has(x));
    if (cidade.length > 0 && cidade.some((tok) => w.includes(tok))) return t;
  }
  return null;
}

/**
 * A prefeitura que os SELOS apontam, casada contra os templates configurados.
 *
 * O campo `cliente` do carimbo é lido em toda prancha ("PREFEITURA MUNICIPAL DE
 * CRICIÚMA") e não era usado para NADA na escolha do template: o slot pedia a
 * prefeitura em toda conversa, mesmo com 71 folhas dizendo qual era. O mecanismo
 * existia (`templateMatch` em `SlotFacts`), estava testado e documentado — só
 * nunca havia sido calculado em produção.
 *
 * O valor DOMINANTE é o que vale. Uma folha com o órgão mal lido não pode
 * arrastar o volume inteiro, e prancha intrusa de outra prefeitura é assunto da
 * conferência de identidade, não deste palpite.
 *
 * `plausibleCount` é quem decide: 1 resolve sozinho; 0 ou mais de 1 continuam
 * sendo PERGUNTA. Quando o carimbo casa com mais de um template (a mesma cidade
 * com variantes), a decisão é humana — ela diz para QUEM o volume vai, e é o
 * erro que este produto existe para impedir.
 */
export function casarPrefeituraDoCarimbo(
  selos: { cliente?: string | null }[],
  prefeituras: AgentPrefeitura[],
):
  | { resolvedId: string | null; plausibleCount: number; plausibles?: AgentPrefeitura[] }
  | undefined {
  const contagem = new Map<string, number>();
  for (const s of selos) {
    const cliente = s.cliente?.trim();
    if (cliente) contagem.set(cliente, (contagem.get(cliente) ?? 0) + 1);
  }
  let dominante = "";
  let maior = 0;
  for (const [nome, n] of contagem) {
    if (n > maior) {
      dominante = nome;
      maior = n;
    }
  }
  if (!dominante) return undefined;

  const plausiveis = prefeituras.filter(
    (p) => matchPrefeitura({ nome: dominante }, [p]) !== null,
  );
  return {
    resolvedId: plausiveis.length === 1 ? plausiveis[0].id : null,
    plausibleCount: plausiveis.length,
    ...(plausiveis.length > 0 ? { plausibles: plausiveis } : {}),
  };
}

/**
 * Disciplinas listadas para as separatrizes: uma folha por item, na ordem dada.
 * Aceita também uma string com quebras de linha ou vírgulas — é como o modelo
 * às vezes devolve, e recusar isso viraria "pedi três e veio uma".
 */
function listaDeTitulos(v: unknown): string[] {
  const brutos = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[\n;,]+/)
      : [];
  const limpos = brutos
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  // Duplicata vira folha repetida no volume — o engenheiro não pediu duas.
  return [...new Set(limpos)].slice(0, 200);
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
          tomoInicial: clampTomoInicial(p.tomoInicial),
          numTomos: clampTomos(p.numTomos),
        },
      });
    } else if (p.kind === "capa") {
      const match = matchPrefeitura(
        { id: String(p.templateId ?? ""), nome: String(p.prefeitura ?? "") },
        ctx.prefeituras,
      );
      /*
       * PREFEITURA INCERTA FICA VAZIA — e vazia vira PERGUNTA.
       *
       * Aqui havia um `|| firstTemplateId`: quando nada casava, a proposta saía
       * com a PRIMEIRA prefeitura configurada. O slot chegava "já respondido",
       * a pergunta nunca acontecia, e o volume era gerado para o município
       * errado sem ninguém ver. Aconteceu: um volume de Criciúma saiu inteiro
       * como Florianópolis, e a correção teve de ser feita à mão.
       *
       * Um palpite aqui é o erro que este produto existe para impedir. Sem
       * certeza, quem decide é o engenheiro.
       */
      const templateId = match?.id ?? String(p.templateId ?? "").trim();
      // Sem prefeitura CONFIGURADA não há capa possível; sem prefeitura
      // ESCOLHIDA há — ela é a pergunta.
      if (ctx.prefeituras.length === 0) continue;
      const volumeRaw = String(p.volume ?? "").trim();
      out.push({
        kind: "capa",
        resumo:
          String(p.resumo ?? "").trim() || `Capa ${match?.nome ?? ctx.disciplina}`,
        params: {
          templateId,
          // Título é DECISÃO: vazio quando a IA não recebeu um do engenheiro.
          tituloCapa: String(p.tituloCapa ?? "").trim(),
          // só dígitos; senão "" (deriva do nome do arquivo no builder)
          volume: /^\d+$/.test(volumeRaw) ? volumeRaw : "",
          numTomos: clampTomos(p.numTomos),
          tomoInicial: clampTomoInicial(p.tomoInicial),
          /*
           * MÊS e ANO da capa. Existiam como slots desde sempre e eram
           * DESCARTADOS aqui: o engenheiro pedia a data no chat, o resolver
           * preenchia o slot, e a proposta saía sem os campos — a capa era
           * gerada com a data corrente e o pedido sumia sem aviso.
           *
           * Vazio continua significando "use o padrão do builder", que é o
           * comportamento de quem não pediu data nenhuma.
           */
          mes: String(p.mes ?? "").trim(),
          ano: String(p.ano ?? "").trim(),
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
          // Lista só entra quando o engenheiro nomeou as disciplinas; vazia, a
          // separatriz herda o título da capa (o comportamento de sempre).
          titulos: listaDeTitulos(p.titulos),
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
