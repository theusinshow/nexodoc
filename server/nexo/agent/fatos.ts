/**
 * Sobre o que o agente pode falar, dado o que a conversa tem.
 *
 * Substitui a guarda "sem selos, recusa o turno" (antiga
 * `app/api/nexo/agent/route.ts:66`), que existia quando o Nexo só montava LD e
 * capa a partir de carimbos. Um memorial não tem selo de prancha, então aquela
 * guarda impedia auditar memorial — o agente respondia "primeiro anexe as
 * pranchas" e nunca chegava a pensar.
 *
 * A guarda não some: vira o caso `temFatos: false`, que é o ÚNICO em que o
 * agente realmente não tem sobre o que falar. Sem ela, ele voltaria a propor LD
 * onde não há prancha — o defeito que o padrão "afirma-fato / pergunta-decisão"
 * existe para evitar.
 *
 * PURO: nenhum import de runtime — roda em Node pelado no teste.
 */

/** O que a classificação determinística leu do memorial anexado. */
export interface FatosDoMemorial {
  fileName: string;
  obra?: string | null;
  municipio?: string | null;
  codigo?: string | null;
  endereco?: string | null;
}

/** De onde veio a régua de identidade da auditoria. */
export type OrigemDoGabarito = "selos" | "memorial" | "nenhuma";

export interface FatosDaConversa {
  temFatos: boolean;
  temSelos: boolean;
  temMemorial: boolean;
  gabarito: {
    obra: string | null;
    municipio: string | null;
    origem: OrigemDoGabarito;
  };
}

/** Texto que só conta quando tem conteúdo — evita gabarito em branco. */
function texto(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * `selos` chega como a lista já lida dos carimbos (só o que interessa aqui: a
 * obra). `memorial` é a classificação do documento, ou `null`.
 *
 * Quando há os DOIS, o carimbo manda no gabarito: ele é fonte INDEPENDENTE do
 * memorial, e é isso que pega o memorial emitido com o nome de outra obra — o
 * erro real que originou o projeto.
 */
export function fatosDaConversa(
  selos: readonly { obra?: string | null }[],
  memorial: FatosDoMemorial | null,
): FatosDaConversa {
  const obraDosSelos = texto(selos.find((s) => texto(s.obra))?.obra);
  const obraDoMemorial = texto(memorial?.obra);

  const origem: OrigemDoGabarito = obraDosSelos
    ? "selos"
    : obraDoMemorial
      ? "memorial"
      : "nenhuma";

  return {
    temFatos: selos.length > 0 || memorial !== null,
    temSelos: selos.length > 0,
    temMemorial: memorial !== null,
    gabarito: {
      obra: obraDosSelos ?? obraDoMemorial,
      municipio: texto(memorial?.municipio),
      origem,
    },
  };
}
