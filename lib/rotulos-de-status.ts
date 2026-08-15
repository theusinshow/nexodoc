/**
 * O QUE O USUÁRIO LÊ ONDE ANTES SAÍA O ENUM DO BANCO.
 *
 * Três telas imprimiam `{status}` cru: `admin/audits` mostrava `COMPLETED`,
 * `admin/lds` mostrava `GENERATED` e o cartão de projeto mostrava `ACTIVE` —
 * em inglês, em caixa alta, para um projetista de drenagem em Criciúma.
 *
 * O detalhe que decidiu escrever isto: **a tradução já existia na mesma tela**.
 * O `<select>` de filtro de `admin/audits` sempre ofereceu "Concluídas" e
 * "Falhas"; o de `admin/lds`, "Rascunho" e "Gerada". A tela sabia falar
 * português no filtro e esquecia na hora de mostrar o resultado do filtro.
 *
 * Aqui ficam os rótulos do SINGULAR — o que descreve UMA linha. Os `<option>`
 * continuam com os seus, no plural, porque descrevem um CONJUNTO ("Concluídas",
 * não "Concluída"): é a mesma palavra em número diferente, não verdade
 * duplicada. Se um dia precisarem casar, casam aqui.
 *
 * Status desconhecido devolve o próprio código em vez de vazio ou de um
 * "—": um enum novo no banco que ninguém traduziu tem que APARECER, e não
 * sumir. É a mesma regra do `--` que não é `0`.
 */

const AUDITORIA: Record<string, string> = {
  PROCESSING: "Processando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
};

const LD: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerada",
  ARCHIVED: "Arquivada",
};

const PROJETO: Record<string, string> = {
  ACTIVE: "Em andamento",
  ARCHIVED: "Arquivado",
};

export function rotuloDeAuditoria(status: string): string {
  return AUDITORIA[status] ?? status;
}

export function rotuloDeLd(status: string): string {
  return LD[status] ?? status;
}

export function rotuloDeProjeto(status: string): string {
  return PROJETO[status] ?? status;
}
