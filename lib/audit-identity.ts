/**
 * Como uma auditoria se chama no histórico administrativo.
 *
 * O Nexo não enviava `auditTitle`/`projectName` — e como ele virou o único
 * caminho, dezenas de auditorias foram gravadas anônimas. O painel listava
 * "Auditoria sem identificação · Projeto não informado" repetido, o que torna o
 * histórico inútil justamente para o que ele serve: achar uma auditoria.
 *
 * O envio já foi corrigido, mas os registros antigos continuam sem título. E
 * eles NÃO estão perdidos: o relatório guardado tem a obra, e os arquivos
 * analisados têm o nome do PDF. Derivar daí é melhor do que uma migração que
 * reescreve dado histórico — aqui nada é alterado no banco, só apresentado.
 *
 * A ordem é da fonte mais confiável para a menos: o que foi declarado na
 * chamada, depois o que a auditoria leu do documento, depois o nome do arquivo.
 */

/** O que basta para nomear uma auditoria. Nenhum campo é obrigatório. */
export interface FonteDeIdentidade {
  title?: string | null;
  projectName?: string | null;
  /** O `report` persistido (JSON) — tem `obra` e `arquivos_analisados`. */
  report?: unknown;
  /**
   * Os arquivos enviados (relação `AuditFile`).
   *
   * É a ÚNICA identidade de uma auditoria que FALHOU: sem relatório, não há
   * obra para derivar — e falha é justamente o que o administrador mais precisa
   * conseguir achar na lista.
   */
  files?: ReadonlyArray<{ fileName?: string | null }> | null;
}

/**
 * Os rótulos que `audit-persistence` GRAVA quando não recebe identidade.
 *
 * O marcador de ausência virou dado: o banco não tem título vazio, tem a frase
 * "Auditoria sem identificação" escrita nele. Sem reconhecê-la como ausência, a
 * derivação nunca dispara — a função acha que o título foi declarado.
 */
const AUSENTE = new Set(["auditoria sem identificação", "projeto não informado"]);

function texto(v: unknown): string {
  if (typeof v !== "string") return "";
  const limpo = v.trim();
  return limpo && !AUSENTE.has(limpo.toLowerCase()) ? limpo : "";
}

/** A obra e o primeiro arquivo, lidos do relatório persistido. */
function doRelatorio(report: unknown): { obra: string; arquivo: string } {
  if (!report || typeof report !== "object") return { obra: "", arquivo: "" };
  const r = report as { obra?: unknown; arquivos_analisados?: unknown };
  const primeiro = Array.isArray(r.arquivos_analisados) ? r.arquivos_analisados[0] : null;
  const arquivo =
    primeiro && typeof primeiro === "object"
      ? texto((primeiro as { arquivo?: unknown }).arquivo)
      : "";
  return { obra: texto(r.obra), arquivo };
}

/** Título de exibição. Vazio nunca — no limite, devolve o rótulo genérico. */
export function tituloDaAuditoria(fonte: FonteDeIdentidade): string {
  const declarado = texto(fonte.title);
  if (declarado) return declarado;

  const { obra, arquivo } = doRelatorio(fonte.report);
  const enviado = texto(fonte.files?.[0]?.fileName);
  return obra || arquivo || enviado || "Auditoria sem identificação";
}

/** Projeto de exibição, com a mesma escada de confiança. */
export function projetoDaAuditoria(fonte: FonteDeIdentidade): string {
  const declarado = texto(fonte.projectName);
  if (declarado) return declarado;

  const { obra } = doRelatorio(fonte.report);
  return obra || "Projeto não informado";
}
