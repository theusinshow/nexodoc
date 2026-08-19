/**
 * OS DOCUMENTOS DO VOLUME CONCORDAM SOBRE A PREFEITURA?
 *
 * Núcleo PURO (sem imports) → roda em node cru:
 * `node scripts/test-coerencia-do-volume.ts`.
 *
 * `normalizeProposals` passou a resolver a prefeitura UMA vez por turno, então
 * documentos divergentes não NASCEM mais. Este portão existe para o que a
 * construção não alcança: o engenheiro editar a prefeitura de UM documento
 * depois de proposto, e a edição não ter por onde avisar o vizinho.
 *
 * O modo de falhar que ele fecha é o pior deste produto — um volume com capa de
 * Criciúma e separatriz de Chapecó, que só se descobre abrindo os dois PDFs
 * lado a lado. Recusar é barato. Reemitir um volume protocolado, não.
 *
 * Ele é DETERMINÍSTICO de propósito: comparar dois identificadores não precisa
 * de modelo, e um portão que depende de IA não é um portão — é mais uma opinião
 * no caminho de quem já decidiu.
 */

export interface DocumentoDoPlano {
  /** Como o documento se chama na tela ("Capa", "Separatriz"). */
  rotulo: string;
  /** O id do modelo de prefeitura. Vazio = não decidida. */
  templateId: string;
}

export interface ProblemaDePrefeitura {
  tipo: "vazia" | "divergente";
  /** A frase que o engenheiro lê. Diz QUEM discorda, não só que discordam. */
  mensagem: string;
}

/**
 * `null` quando pode gerar.
 *
 * A ordem das checagens importa. Vazio é a causa comum e tem conserto óbvio —
 * responder a pergunta. Divergência é rara, exige olhar dois documentos e
 * merece a frase mais específica; checá-la primeiro faria um volume inteiro sem
 * prefeitura ser descrito como "os documentos discordam", que é confuso e
 * falso.
 */
export function conferirPrefeitura(
  documentos: readonly DocumentoDoPlano[],
): ProblemaDePrefeitura | null {
  if (documentos.length === 0) return null;

  const vazios = documentos.filter((d) => !d.templateId.trim());
  if (vazios.length > 0) {
    const quais = vazios.map((d) => d.rotulo).join(", ");
    return {
      tipo: "vazia",
      mensagem:
        `A prefeitura ainda não foi escolhida (${quais}). ` +
        "O volume inteiro espera essa decisão — ela sai impressa na capa e na separatriz.",
    };
  }

  const porId = new Map<string, string[]>();
  for (const d of documentos) {
    const id = d.templateId.trim();
    const lista = porId.get(id);
    if (lista) lista.push(d.rotulo);
    else porId.set(id, [d.rotulo]);
  }
  if (porId.size <= 1) return null;

  const partes = [...porId.entries()]
    .map(([id, rotulos]) => `${rotulos.join(" e ")} → ${id}`)
    .join("; ");
  return {
    tipo: "divergente",
    mensagem:
      `Os documentos deste volume discordam sobre a prefeitura: ${partes}. ` +
      "Um volume tem uma prefeitura só.",
  };
}
