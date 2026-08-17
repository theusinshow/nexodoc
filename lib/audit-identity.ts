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

/**
 * COMO O ESCRITÓRIO CHAMA UMA AUDITORIA: `084_25-CRICIUMA`.
 *
 * Centro de custo e prefeitura, nessa ordem — é o par que o engenheiro usa para
 * achar qualquer coisa, porque é o que está na pasta, no carimbo e no e-mail. O
 * nome da obra não serve para isso: "Reforma e Adequação da Emeb (escola
 * Municipal de Ensino Básico) Rubens de Arruda Ramos" não cabe numa lista, e
 * duas obras do mesmo programa têm nomes quase idênticos.
 *
 * Até aqui o Nexo mandava a OBRA como título e projeto, e era ela que ficava
 * gravada — o histórico e o painel administrativo nunca mostraram o centro de
 * custo, mesmo tendo os dois campos em mãos desde a classificação do documento.
 *
 * O SEPARADOR DO CÓDIGO É PRESERVADO como veio do documento: `084_25` e `084-25`
 * são o mesmo centro de custo (é [[resolucao-de-projeto.ts]] quem os concilia
 * para CASAR projeto), mas aqui o valor é para LER, e reescrever o que está no
 * carimbo faria a pessoa procurar por uma grafia que ela nunca viu.
 *
 * Devolve "" quando falta qualquer uma das duas metades. Meia identidade não é
 * identidade: "084_25-" ou "-CRICIUMA" ordenam pior que o nome do arquivo, que
 * é o que a escada de cima já sabe usar como último recurso.
 */
export function centroDeCustoDaAuditoria(
  codigo?: string | null,
  prefeituraOuMunicipio?: string | null,
): string {
  const cc = (codigo ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const bruto = (prefeituraOuMunicipio ?? "").trim();

  if (!cc || !bruto) return "";

  const municipio = bruto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    // "PREFEITURA MUNICIPAL DE CRICIUMA / SECRETARIA ..." → o órgão lido do
    // documento vem inteiro; o que identifica a pasta é só o município.
    .replace(/^PREFEITURA\s+(?:MUNICIPAL\s+)?(?:DE\s+|DO\s+|DA\s+)?/, "")
    .replace(/^MUNICIPIO\s+(?:DE\s+|DO\s+|DA\s+)?/, "")
    .split("/")[0]
    // Sufixo de estado: "CRICIUMA - SC", "CRICIUMA, SC".
    .replace(/[\s,-]+[A-Z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return municipio ? `${cc}-${municipio}` : "";
}
