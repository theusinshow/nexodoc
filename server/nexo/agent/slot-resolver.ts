/**
 * SlotResolver DETERMINÍSTICO (§3 da ARQUITETURA.md). Dado um artefato-alvo, os
 * fatos agregados e os slots já preenchidos, decide O QUE já está resolvido, QUAL
 * é o próximo faltante e se o artefato está PRONTO para propor. A IA não participa
 * desta decisão — ela só redige o `prompt` e enriquece as `suggestions` depois.
 *
 * Regra por slot (§3): resolvido se já veio preenchido em `slots` (o usuário
 * mandou) OU se `deriveFrom(facts)` dá valor (fato determinístico). Fatos NUNCA
 * viram slot — é o `deriveFrom` que os auto-resolve (ex.: prefeitura casada por
 * município já entra pré-resolvida via `facts.templateMatch`). `nextMissing` é o
 * 1º REQUIRED não resolvido; `pronto` = todos os required resolvidos.
 *
 * FOLHA PURA: SÓ `import type` — zero import de runtime (nem local nem `@/`). Por
 * isso o REGISTRO de requisitos (`ARTIFACT_REQUIREMENTS`) chega por ARGUMENTO
 * (`input.requirements`), em vez de import de runtime de `./requirements.ts`: o
 * chamador (test/route, que carrega o registro) o injeta. Roda no `node` cru
 * (`test:nexo:slots`).
 */
import type {
  NexoArtifactKind,
  NexoSlotRequest,
} from "@/modules/nexo/types";
import type { SlotId, SlotState } from "@/modules/nexo/state/session-reducer";
import type { SlotDef, SlotFacts } from "./requirements";

export interface ResolveSlotsInput {
  taskKind: NexoArtifactKind;
  facts: SlotFacts;
  slots: Record<SlotId, SlotState>;
  /** Registro de requisitos por kind, injetado pelo chamador (folha pura). */
  requirements: Record<NexoArtifactKind, SlotDef[]>;
}

export interface ResolveSlotsResult {
  /** Slots já resolvidos (valor vindo de `slots` ou derivado dos fatos). */
  resolved: Record<SlotId, string>;
  /** 1º required não resolvido, montado como pedido de slot; `null` se completo. */
  nextMissing: NexoSlotRequest | null;
  /** Todos os required resolvidos → dá pra propor o artefato. */
  pronto: boolean;
}

/** Valor não-vazio de um slot já preenchido pelo usuário, ou `null`. */
function slotValue(slots: Record<SlotId, SlotState>, id: SlotId): string | null {
  const v = slots[id]?.value;
  return v != null && v.trim() !== "" ? v : null;
}

/**
 * Resolve os slots de `taskKind`. Determinístico e sem efeitos colaterais.
 */
export function resolveSlots(input: ResolveSlotsInput): ResolveSlotsResult {
  const defs = input.requirements[input.taskKind] ?? [];
  const resolved: Record<SlotId, string> = {};
  const faltantesRequired: SlotDef[] = [];
  /*
   * TERCEIRA CATEGORIA: pergunta, mas não trava.
   *
   * Antes só havia dois estados — required (bloqueia e é perguntado) e o resto
   * (some em silêncio). A data da capa caía no segundo: era derivada do mês
   * corrente e NUNCA perguntada, então o engenheiro que quisesse outra data só
   * descobria abrindo o PDF. Torná-la required resolveria isso e criaria pior:
   * duas perguntas obrigatórias em todo projeto, inclusive naqueles em que o
   * padrão já estava certo.
   *
   * Estes são perguntados quando não há required pendente, e o botão de gerar
   * continua liberado — quem ignorar leva o padrão, que o resumo mostra.
   */
  const faltantesOpcionais: SlotDef[] = [];

  for (const def of defs) {
    // 1) o usuário já preencheu (override explícito vence o default derivado).
    const fromSlot = slotValue(input.slots, def.id);
    if (fromSlot != null) {
      resolved[def.id] = fromSlot;
      continue;
    }
    // 2) fato determinístico se auto-resolve (nunca vira slot).
    const derived = def.deriveFrom(input.facts);
    if (derived != null && derived.trim() !== "") {
      resolved[def.id] = derived;
      continue;
    }
    // 3) faltante: o required bloqueia; o "perguntável" só entra na fila.
    if (def.required) faltantesRequired.push(def);
    else if (def.perguntarSeFaltar) faltantesOpcionais.push(def);
  }

  /*
   * O REQUIRED vem primeiro, sempre. Perguntar a data antes do título faria a
   * conversa cuidar do acessório enquanto o essencial segue em aberto.
   */
  const first = faltantesRequired[0] ?? faltantesOpcionais[0] ?? null;
  const nextMissing: NexoSlotRequest | null = first
    ? {
        slotId: first.id,
        taskKind: first.taskKind,
        prompt: first.prompt,
        optional: !first.required,
        suggestions: first.suggest(input.facts),
      }
    : null;

  return {
    resolved,
    nextMissing,
    // `pronto` continua sendo só sobre os REQUIRED: o perguntável não segura
    // a geração, senão ele seria required com outro nome.
    pronto: faltantesRequired.length === 0,
  };
}
