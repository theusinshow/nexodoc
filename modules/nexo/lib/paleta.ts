/**
 * A PALETA — as ações que se alcançam pelo teclado, e só as ações.
 *
 * As CONVERSAS não moram aqui: quem as filtra é `groupConversations`, que já
 * cobre título e nome da pasta e já é usado pela barra lateral. Uma segunda
 * busca de conversas dentro da paleta acharia coisas diferentes da barra com o
 * mesmo texto digitado — e a pessoa não teria como saber qual das duas está
 * errada.
 *
 * NENHUMA AÇÃO DESTRUTIVA. É regra da proposta e vale repetir onde ela é
 * aplicada: a paleta é alcançada por acidente (um `Ctrl+K` que se queria
 * `Ctrl+C`), e uma lista onde "apagar a conversa" fica a duas teclas de
 * distância transforma o atalho num risco. Tudo aqui é navegar ou escrever.
 *
 * PURO: roda no node cru.
 */

// Extensão `.ts` para o módulo rodar em node cru — o mesmo arranjo de
// `lib/audit-report.ts` e `parse-filename.ts`.
import { PARTIDAS } from "./partidas.ts";

export interface AcaoDaPaleta {
  id: string;
  rotulo: string;
  /** Cabeçalho da seção na lista. */
  grupo: "Começar" | "Ir para";
  /** Palavras que também encontram esta ação, além do rótulo. */
  sinonimos?: readonly string[];
  /** Navegar para cá. Ausente nas partidas, que escrevem no composer. */
  href?: string;
  /** Escrever esta frase no composer (as partidas). */
  frase?: string;
}

/** minúsculas, sem acento — "conferencia" tem de achar "Conferir as folhas". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export const ACOES_DA_PALETA: readonly AcaoDaPaleta[] = [
  /*
   * AS PARTIDAS VÊM DA MESMA LISTA que os chips da entrada. Se a paleta
   * tivesse a sua cópia, o mesmo comando pediria coisas diferentes conforme o
   * caminho por onde a pessoa chegou.
   */
  ...PARTIDAS.map((p) => ({
    id: `partida:${p.id}`,
    rotulo: p.rotulo,
    grupo: "Começar" as const,
    frase: p.frase,
    sinonimos: [p.frase],
  })),
  {
    id: "ir:projetos",
    rotulo: "Projetos",
    grupo: "Ir para",
    href: "/projetos",
    sinonimos: ["obras"],
  },
  {
    id: "ir:volumes",
    rotulo: "Mesa de volumes",
    grupo: "Ir para",
    href: "/volumes",
    sinonimos: ["montar volume de PDFs soltos"],
  },
  {
    id: "ir:ferramentas",
    rotulo: "Ferramentas",
    grupo: "Ir para",
    href: "/ferramentas",
  },
];

/** As ações do admin só entram para quem é admin — atalho não cria permissão. */
export const ACOES_DE_ADMIN: readonly AcaoDaPaleta[] = [
  { id: "ir:admin", rotulo: "Painel admin", grupo: "Ir para", href: "/admin" },
  {
    id: "ir:admin-usage",
    rotulo: "Consumo",
    grupo: "Ir para",
    href: "/admin/usage",
    sinonimos: ["custo", "gasto", "quanto custou"],
  },
  {
    id: "ir:admin-quality",
    rotulo: "Qualidade do motor",
    grupo: "Ir para",
    href: "/admin/quality",
    sinonimos: ["falso positivo", "meta"],
  },
];

/**
 * As ações que casam com o texto — na ordem em que foram declaradas.
 *
 * SEM PONTUAÇÃO DE RELEVÂNCIA. A lista tem menos de dez itens e a ordem é
 * deliberada (começar antes de ir para); um ranking aqui embaralharia uma
 * ordem pensada para ganhar precisão que ninguém pediu num conjunto deste
 * tamanho.
 */
export function filtrarAcoes(
  query: string,
  acoes: readonly AcaoDaPaleta[] = ACOES_DA_PALETA,
): AcaoDaPaleta[] {
  const q = normalizar(query);
  if (!q) return [...acoes];
  return acoes.filter(
    (a) =>
      normalizar(a.rotulo).includes(q) ||
      (a.sinonimos ?? []).some((s) => normalizar(s).includes(q)),
  );
}
