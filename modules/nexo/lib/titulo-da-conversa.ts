/**
 * COMO UMA CONVERSA SE CHAMA NA BARRA LATERAL.
 *
 * Vivia dentro de `conversation-store.tsx` como `deriveTitle`, e só sabia
 * derivar de DUAS fontes: a obra lida do carimbo das pranchas e, na falta dela,
 * a primeira frase que o usuário digitou.
 *
 * Numa conversa só de MEMORIAL — que é o caminho principal do produto — não há
 * carimbo nenhum. O título caía na primeira mensagem, e o histórico virava uma
 * pilha de "Anexei o memorial — 084_25_md_geral_a.pdf" indistinguíveis. Era
 * disso que o Matheus falava em 17/08/2026: "o histórico fica totalmente
 * apagado".
 *
 * O centro de custo com a prefeitura — `084_25-CRICIUMA` — é como o escritório
 * chama um projeto: está na pasta, no carimbo e no e-mail. Ele vem PRIMEIRO, e
 * a classificação do memorial já o entrega antes de a auditoria começar.
 *
 * PURO e testável em node cru: quem tem o estado é o store.
 */
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";

/** O que a classificação leu do memorial. Subconjunto de `NexoDossieDraft`. */
export type IdentidadeLida = {
  codigo?: string | null;
  orgao?: string | null;
  municipio?: string | null;
  obra?: string | null;
} | null;

const MAX_OBRA = 60;
const MAX_FRASE = 48;

function encurtar(valor: string, teto: number): string {
  return valor.length > teto ? `${valor.slice(0, teto - 3)}…` : valor;
}

/**
 * A escada, da fonte que mais identifica para a que menos:
 *
 * 1. `084_25-CRICIUMA` — centro de custo e prefeitura. Cabe na lista, distingue
 *    dois projetos do mesmo programa e é por ele que se procura.
 * 2. A OBRA, de qualquer fonte que a tenha (carimbo ou memorial). Identifica,
 *    mas é longa e quase idêntica entre obras irmãs.
 * 3. A primeira frase do usuário — o que existia antes, e o último recurso.
 *
 * Nunca devolve vazio: no limite, mantém o que já estava lá.
 */
export function tituloDaConversa(args: {
  atual: string;
  /** A primeira mensagem do usuário, se houver. */
  primeiraFrase?: string;
  /** Obra lida do carimbo das pranchas. */
  obraDosSelos?: string;
  /** O que a classificação leu do memorial. */
  identidade?: IdentidadeLida;
}): string {
  const centroDeCusto = centroDeCustoDaAuditoria(
    args.identidade?.codigo,
    args.identidade?.orgao || args.identidade?.municipio,
  );
  if (centroDeCusto) return centroDeCusto;

  const obra = args.obraDosSelos?.trim() || args.identidade?.obra?.trim();
  if (obra) return encurtar(obra, MAX_OBRA);

  const frase = args.primeiraFrase?.trim();
  if (frase) return encurtar(frase, MAX_FRASE);

  return args.atual || "Nova conversa";
}
