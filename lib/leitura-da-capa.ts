/**
 * A CAPA DO MEMORIAL — a fonte padrão da identidade da obra.
 *
 * 17/09/2026. O memorial de São José (027_24) chegou ao chat com a obra
 * "• Diário de Obra em dia": o rodapé não casou e a busca do campo "Obra:"
 * pegou prosa da página 40. A decisão foi ler a CAPA primeiro, em todo modelo
 * de prefeitura, e deixar rodapé e corpo como fallback. Ver
 * `docs/superpowers/specs/2026-09-17-leitura-da-capa-design.md`.
 *
 * Reconhece cada linha da página 1 pelo PAPEL (timbre, secretaria, fase,
 * título, bairro, data, código…); o que sobra entre o timbre e o primeiro
 * papel reconhecido é o nome da obra. Não depende de qual modelo gerou a capa:
 * os modelos de `templates/capas` são conferidos em `test-capa-dos-modelos.ts`.
 *
 * PURO e sem `@/`: prova em node cru, sem PDF.
 */

export interface LeituraDaCapa {
  /**
   * SEMPRE `PREFEITURA MUNICIPAL DE <CIDADE>`, mesmo quando a capa diz
   * "GOVERNO DO MUNICÍPIO DE". A marca da prefeitura, a pasta da conversa e o
   * `defaults.orgao` dos modelos usam esta forma; guardar a impressa apagaria
   * a cor da marca de Criciúma.
   */
  orgao: string;
  secretaria: string;
  /** A cidade como impressa, ou com a grafia do candidato no timbre espaçado. */
  municipio: string;
  /** Como impresso, sem mexer na caixa: é o que vai para `{{NOME_OBRA}}`. */
  obra: string;
  /** Com o prefixo ("BAIRRO SÃO JOÃO"): o modelo de Criciúma imprime `{{BAIRRO}}` sozinho. */
  bairro: string;
  mesAno: string;
  /** Com hífen: "027-24". */
  codigo: string;
}

type Papel =
  | "estado"
  | "timbre"
  | "secretaria"
  | "fase"
  | "titulo"
  | "volume"
  | "bairro"
  | "mesAno"
  | "codigo"
  | "escritorio"
  | "livre";

/** Sem acento, maiúsculo e sem espaço: a forma em que o timbre espaçado é comparável. */
function chave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

function espacos(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

const TIMBRE = /^(?:PREFEITURAMUNICIPALDE|GOVERNODOMUNICIPIODE)/;
const MES_ANO =
  /^(?:JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\/?\d{4}$/;
const ANCORAS_DE_FIM: readonly Papel[] = ["fase", "titulo", "volume"];

/**
 * "E S T A D O D E …" → "ESTADODE…". A extração entrega a capa de Criciúma com
 * as letras espaçadas; quatro pedaços de um caractere é o mínimo para não colar
 * uma linha curta de verdade ("Vol. I").
 */
function colarLetras(linha: string): { texto: string; espacada: boolean } {
  const partes = linha.trim().split(/\s+/);
  const espacada = partes.length >= 4 && partes.every((p) => [...p].length === 1);
  return { texto: espacada ? partes.join("") : espacos(linha), espacada };
}

function papelDaLinha(texto: string): Papel {
  const k = chave(texto);
  if (k === "ESTADODESANTACATARINA") return "estado";
  if (TIMBRE.test(k)) return "timbre";
  if (k.startsWith("SECRETARIA")) return "secretaria";
  if (/^(?:PROJETO(?:EXECUTIVO|BASICO)|ANTEPROJETO|ESTUDOPRELIMINAR)$/.test(k)) return "fase";
  if (k.startsWith("MEMORIALDESCRITIVO") || /^VOLUME\d+[-–]/.test(k)) return "titulo";
  if (/^VOL\.[IVXLC\d]+$/.test(k)) return "volume";
  if (k.startsWith("BAIRRO")) return "bairro";
  if (MES_ANO.test(k)) return "mesAno";
  if (/^\d{2,4}[-_]\d{2}$/.test(k)) return "codigo";
  if (k.includes("PROJETOS,SUPERVISAOEPLANEJAMENTO")) return "escritorio";
  return "livre";
}

/**
 * A cidade do timbre. Na linha normal, o que vem depois de "…DE", até um
 * travessão ou pontuação. Na espaçada as fronteiras das palavras sumiram
 * ("SÃOJOSÉ"), então só vale um candidato do próprio documento que, colado,
 * seja igual ao resto do timbre.
 */
function cidadeDoTimbre(
  texto: string,
  espacada: boolean,
  candidatos: readonly string[],
): string {
  if (espacada) {
    const resto = chave(texto).replace(TIMBRE, "");
    return candidatos.find((c) => c.trim() && chave(c) === resto)?.trim() ?? "";
  }
  const bruta =
    /^(?:PREFEITURA\s+MUNICIPAL\s+DE|GOVERNO\s+DO\s+MUNIC[IÍií]PIO\s+DE)\s+(.+)$/i.exec(texto)?.[1] ?? "";
  const corte = /\s[–-]\s|[.,;/(]/.exec(bruta);
  return espacos(corte ? bruta.slice(0, corte.index) : bruta);
}

export function lerCapa(
  texto: string,
  candidatosDeMunicipio: readonly string[] = [],
): LeituraDaCapa | null {
  const pagina1 = /--- PAGINA 1 ---\n([\s\S]*?)(?=\n--- PAGINA 2 ---|$)/.exec(texto)?.[1];
  if (pagina1 === undefined) return null;

  const linhas = pagina1
    .split("\n")
    .map(colarLetras)
    .filter((l) => l.texto);
  const papeis = linhas.map((l) => papelDaLinha(l.texto));

  const iTimbre = papeis.indexOf("timbre");
  if (iTimbre === -1) return null;
  const iFim = papeis.findIndex((p, i) => i > iTimbre && ANCORAS_DE_FIM.includes(p));
  if (iFim === -1) return null;

  let i = iTimbre + 1;
  const secretarias: string[] = [];
  while (i < iFim && papeis[i] === "secretaria") secretarias.push(linhas[i++].texto);
  const nome: string[] = [];
  while (i < iFim && papeis[i] === "livre") nome.push(linhas[i++].texto);

  const junto = espacos(nome.join(" "));
  const obra = nome.length <= 4 && junto.length >= 4 && junto.length <= 160 ? junto : "";

  const primeira = (papel: Papel) =>
    linhas.find((_, j) => j > iTimbre && papeis[j] === papel)?.texto ?? "";
  const cidade = cidadeDoTimbre(
    linhas[iTimbre].texto,
    linhas[iTimbre].espacada,
    candidatosDeMunicipio,
  );

  return {
    orgao: cidade ? `PREFEITURA MUNICIPAL DE ${cidade.toLocaleUpperCase("pt-BR")}` : "",
    secretaria: secretarias[0] ?? "",
    municipio: cidade,
    obra,
    bairro: primeira("bairro"),
    mesAno: primeira("mesAno"),
    codigo: primeira("codigo").replace("_", "-"),
  };
}

/**
 * O código do nome do arquivo manda (é a chave do projeto no sistema); o da
 * capa só confere. Devolve o SINAL quando os dois existem e divergem.
 */
export function divergenciaDeCodigo(doArquivo: string, daCapa: string): string | null {
  const a = doArquivo.trim().replace("_", "-");
  const c = daCapa.trim().replace("_", "-");
  if (!a || !c || a === c) return null;
  return `código da capa (${c}) diverge do nome do arquivo (${a})`;
}
