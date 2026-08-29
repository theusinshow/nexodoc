/**
 * O TRACE DO TURNO — o que o agente fez, dito em uma linha.
 *
 * Transparência de bastidor é o que faz engenheiro confiar em automação. O orbe
 * já sinaliza AO VIVO que algo acontece, e some quando termina: a conversa
 * ficava sem registro nenhum de quanto foi lido, o que foi proposto e quanto
 * tempo custou. Numa conversa de quarenta turnos, "por que ele propôs a LD?"
 * não tinha onde ser respondida.
 *
 * NÃO É DEBUG. Nada de nome de modelo, id de chamada ou contagem de token — o
 * `NexoDebugDrawer` já cobre isso, e para outro leitor. Aqui é linguagem de
 * trabalho: quantas folhas ele leu, o que ele propôs, quanto demorou.
 *
 * TURNO SIMPLES NÃO GANHA LINHA. "Olá" não leu nada e não propôs nada; imprimir
 * "0 selos · 0,4s" seria gastar uma linha por turno para não dizer nada — e o
 * ruído apagaria os traces que informam.
 *
 * PURO: roda no node cru.
 */

export interface DadosDoTurno {
  /** Selos que o turno teve em mãos — o contexto que ele leu. */
  selosLidos: number;
  /** O que ele propôs, pelo `kind` do artefato. */
  propostas: readonly string[];
  duracaoMs: number;
}

/** Os mesmos nomes que o resto da tela usa — dois vocabulários confundiriam. */
const NOME_DA_PROPOSTA: Record<string, string> = {
  capa: "capa",
  ld: "LD",
  separatriz: "separatriz",
  volume: "volume",
  conferencia: "conferência",
  auditoria: "auditoria",
};

/** "8,4s" — vírgula decimal, que é como se lê em português. */
function segundos(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}

/**
 * Junta a lista como se fala: "LD e capa", "LD, capa e separatriz".
 *
 * Sem repetir: o agente propõe capa e separatriz de vários tomos na mesma
 * resposta, e "capa, capa, capa" contaria o mesmo trabalho três vezes.
 */
function comE(itens: readonly string[]): string {
  const unicos = [...new Set(itens)];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} e ${unicos[unicos.length - 1]}`;
}

export function traceDoTurno(dados: DadosDoTurno): string | null {
  const propostas = dados.propostas
    .map((k) => NOME_DA_PROPOSTA[k] ?? k)
    .filter(Boolean);

  // Nada lido e nada proposto: o turno foi conversa, e conversa não tem
  // bastidor a mostrar.
  if (dados.selosLidos === 0 && propostas.length === 0) return null;

  const partes: string[] = [];
  if (dados.selosLidos > 0) {
    partes.push(
      `leu ${dados.selosLidos} ${dados.selosLidos === 1 ? "selo" : "selos"}`,
    );
  }
  if (propostas.length > 0) partes.push(`propôs ${comE(propostas)}`);
  /*
   * O TEMPO SÓ ACOMPANHA — nunca aparece sozinho. Ele qualifica um trabalho que
   * a linha já nomeou; sem trabalho nomeado, "0,4s" é uma métrica sem assunto.
   */
  if (Number.isFinite(dados.duracaoMs) && dados.duracaoMs > 0) {
    partes.push(segundos(dados.duracaoMs));
  }

  return partes.join(" · ");
}
