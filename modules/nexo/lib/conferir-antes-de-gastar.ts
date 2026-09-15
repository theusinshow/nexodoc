/**
 * CONFERIR COM O SERVIDOR ANTES DE GASTAR — 15/09/2026, depois da segunda
 * rodada da bateria.
 *
 * A trava da aba desatualizada (jornada c3) só acendia quando a aba GRAVAVA: o
 * 409 do servidor, ou o disco mais novo que a base. Então o PRIMEIRO gesto
 * pago de uma aba parada — auditar, mandar um turno ao agente, conferir o
 * volume — ainda saía: o modelo rodava, a resposta voltava, e só a gravação
 * dela levava o 409 e era descartada. Pago e perdido.
 *
 * Agora quem vai gastar pergunta antes a versão que o servidor guarda e aplica
 * a MESMA regra da rota (`gravacaoDesatualizada`): mais nova que a base desta
 * aba e que não seja uma das próprias sem confirmação é trabalho de outra aba ou
 * máquina. Aí não gasta, e a aba trava como num 409 (ver
 * `conferirAntesDeGastar` em `fila-de-gravacao.ts`).
 *
 * Sem resposta do servidor (rede fora, instalação sem banco), deixa gastar: o
 * Nexo offline continua sendo o de sempre. Mas a base NÃO fica conferida — só
 * uma leitura de verdade confere, e é ela que decide se um 409 posterior desce
 * a cópia do servidor por cima do disco.
 *
 * PURO: só a regra da rota, que também é pura. Roda no node cru.
 */
import { gravacaoDesatualizada } from "../../../server/nexo/conversa-remota.ts";

/** O que a pergunta ao servidor trouxe. */
export type LeituraDoServidor =
  /** `guardada` é o `updatedAt` que o servidor tem; `null` se não tem a conversa. */
  | { estado: "lida"; guardada: number | null }
  /** Instalação sem banco: não há versão a conferir. */
  | { estado: "sem-servidor" }
  /** Rede fora, erro, ou demorou demais. */
  | { estado: "inalcancavel" };

export function decidirAntesDeGastar(args: {
  leitura: LeituraDoServidor;
  /** A base desta aba (a versão que ela leu ou teve confirmada). */
  base: number | null;
  /** As versões que esta aba mandou e o servidor ainda não confirmou. */
  proprias: readonly number[];
}): { gastar: boolean; conferida: boolean } {
  if (args.leitura.estado !== "lida") return { gastar: true, conferida: false };
  const { guardada } = args.leitura;
  if (
    gravacaoDesatualizada({
      guardada,
      base: args.base,
      proprias: args.proprias,
    })
  ) {
    return { gastar: false, conferida: false };
  }
  // O servidor tem a conversa e ela não passa da base: a base está conferida.
  return { gastar: true, conferida: guardada !== null && args.base !== null };
}

/**
 * A resposta de `GET /api/nexo/conversas?id=` vira leitura (revisão da frente
 * A, 15/09/2026: a conferência lê só a versão daquela conversa, e não a lista
 * inteira com as lápides).
 *
 * - `sincronizando: false` (sem banco) ou 404 (módulo desligado): sem servidor.
 * - `updatedAt` número ou null: lida.
 * - Qualquer outra coisa — 5xx, 401, corpo torto: fora do alcance, e o gesto
 *   segue sem conferir a base, como offline.
 */
export function leituraDaResposta(resposta: {
  ok: boolean;
  status: number;
  corpo: unknown;
}): LeituraDoServidor {
  if (resposta.status === 404) return { estado: "sem-servidor" };
  if (!resposta.ok || !resposta.corpo || typeof resposta.corpo !== "object") {
    return { estado: "inalcancavel" };
  }
  const corpo = resposta.corpo as {
    sincronizando?: unknown;
    updatedAt?: unknown;
  };
  if (corpo.sincronizando === false) return { estado: "sem-servidor" };
  if (corpo.sincronizando !== true) return { estado: "inalcancavel" };
  if (corpo.updatedAt === null) return { estado: "lida", guardada: null };
  if (typeof corpo.updatedAt === "number" && Number.isFinite(corpo.updatedAt)) {
    return { estado: "lida", guardada: corpo.updatedAt };
  }
  return { estado: "inalcancavel" };
}
