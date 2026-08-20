import { parseFilename, resolveSheetNumbers } from "./parse-filename";
import { totalDeReferencia } from "./reconcile-sheets";
import { disciplinaLabel, nomeNoDocumento } from "./disciplinas";
import {
  formatSheet,
  buildBalancedTomos,
  faixasDosTomos,
  type Tomo,
} from "@/lib/ld/ld-rules";
import { cleanStampDescription } from "@/lib/ld/stamp-parsing";
import type { CreateLDInput } from "./tools/create-ld";

/** Um selo lido de uma prancha (subconjunto do StampExtraction que interessa aqui). */
export interface SeloForLd {
  fileName: string;
  /** Página do selo dentro do PDF (p/ reconciliar folha em PDF combinado). */
  pageNumber?: number | null;
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  /** Valor do campo ARQUIVO do selo (código da prancha) — vai na coluna ARQUIVOS. */
  arquivo: string | null;
  /**
   * Número da folha corrigido À MÃO no canvas. Vence o carimbo, o nome do
   * arquivo e a reconciliação — ver `SeloSheetInput.folhaManual`.
   */
  folhaManual?: number | null;
  conteudo: string | null;
  cliente: string | null;
  /** Secretaria/órgão emissor lido no cabeçalho do carimbo (p/ a capa). */
  secretaria: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
  /**
   * Texto do campo DATA do carimbo, como impresso ("JUNHO/2026", "JUN/26").
   *
   * Cru de propósito: quem interpreta é `parseDataDoSelo` (`data-do-selo.ts`),
   * e guardar o texto original deixa a leitura conferível quando a data sair
   * errada. Opcional porque nem todo caminho que monta um selo passa pela
   * leitura de carimbo (retomada de conversa, projeto de exemplo, fixtures).
   */
  data?: string | null;
  /**
   * A quem pertence o BRASÃO de órgão público da folha, pelo que está escrito
   * nele — nunca deduzido do desenho, e nunca o logotipo da projetista.
   *
   * Segunda evidência da prefeitura, ao lado de `cliente`. Ver
   * `casarPrefeituraDoCarimbo`: quando os dois discordam, o volume não resolve
   * sozinho — brasão trocado é o acidente que o produto existe para pegar.
   */
  logoOrgao?: string | null;
}

export interface LdProposal {
  input: CreateLDInput;
  /** Diagnóstico p/ a UI: o que foi inferido e de onde. */
  resumo: {
    /** Rótulo de UI, em maiúsculas ("ESTRUTURAL"). Para mostrar, não para consultar. */
    disciplina: string;
    /**
     * O CÓDIGO canônico de três letras ("est") — a chave do léxico.
     *
     * Existe separado porque `disciplina` é o rótulo e não serve de chave:
     * `nomeNaCapa("ESTRUTURAL")` devolve undefined, e quem passasse o rótulo
     * ganharia silenciosamente um título vazio.
     */
    disciplinaCode: string;
    codigo: string;
    revisao: string;
    obra: string;
    totalFolhas: number;
  };
}

/** Parse do nome, preferindo o código do CARIMBO (per-prancha) ao nome do upload
 *  (que num PDF combinado é o do tomo/volume, sem folha/revisão por prancha). */
function parseSelo(s: SeloForLd) {
  return parseFilename(s.arquivo?.trim() || s.fileName);
}

function sheetOrder(sheet: string): number {
  const n = parseInt(sheet.split("/")[0] ?? "", 10);
  return Number.isNaN(n) ? 9999 : n;
}

/**
 * Detecta texto de órgão/secretaria que o OCR às vezes captura no campo de título
 * ("SECRETARIA DE DESENVOLVIMENTO... SEDES"). Não serve como título da LD — o
 * título é técnico ("PROJETO ESTRUTURAL"). Usado para descartar esses valores.
 */
function isOrgaoLike(value: string): boolean {
  return /\b(secretaria|prefeitura|municipal|munic[íi]pio|departamento|sedes|gabinete|funda[çc][ãa]o|governo)\b/i.test(
    value,
  );
}

/** Só pranchas: exclui capa/memorial/separatriz/orçamento/volume lidos por engano. */
function isPranchaSelo(s: SeloForLd): boolean {
  const t = parseSelo(s).tipo;
  return t !== "capa" && t !== "memorial" && t !== "separatriz" && t !== "orcamento" && t !== "volume";
}

/** Valor mais frequente (não-vazio) entre os selos — para strings. */
function mode(values: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = v?.trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** Valor mais frequente (>0) — para números (total dominante). */
function modeNumber(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) if (Number.isFinite(v) && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** Rótulo da disciplina desta prancha (LABEL), para casar com o LABEL da LD e
 *  não disparar falso "disciplina divergente" (o validador compara rótulos). */
function rowDisciplineLabel(s: SeloForLd): string {
  const parsed = parseSelo(s);
  const code = parsed.disciplinas[0] || (s.disciplina ? s.disciplina.toLowerCase() : "");
  return (disciplinaLabel(code) ?? s.disciplina ?? "").toUpperCase();
}

export interface BuildLdOptions {
  /** Divide as folhas em N tomos balanceados (decisão do engenheiro). Default 1. */
  numTomos?: number;
  /** Tomo ESPECÍFICO (ex.: 4): a seção vira "... (TOMO 04)". 0 = usar numTomos. */
  tomoNumero?: number;
  /**
   * A partir de qual tomo CONTAR (default 1). A numeração pertence ao VOLUME:
   * se outra disciplina do mesmo volume já ocupou 01-03, aqui vem 4. Precisa
   * casar com o `tomoInicial` da capa, senão LD e capa discordam no volume.
   */
  tomoInicial?: number;
  /**
   * QUAL dos `numTomos` esta LD é (1-based). Quando informado, a proposta traz
   * SÓ as folhas daquele tomo — cada tomo é um volume físico com a sua fatia.
   * 0 = documento único com todos os tomos como seções (comportamento antigo).
   */
  tomoAtual?: number;
  /** Título da seção (decisão do engenheiro). Vazio = palpite do selo. */
  tituloLd?: string;
  /**
   * Mantém a ordem em que as folhas chegaram, em vez de ordenar pelo número do
   * carimbo. Só o CLIENTE sabe se o usuário reordenou alguma folha daquele tomo
   * no canvas — por isso a decisão chega pronta, e o padrão continua sendo o
   * carimbo mandar (comportamento validado à mão em todo projeto sem arrasto).
   */
  respeitarOrdem?: boolean;
  /**
   * Os ids (`arquivo#pagina`) das folhas DESTE tomo, decididos pelo canvas. Quando
   * vem, manda: substitui a divisão por quantidade (`faixasDosTomos`), que ignora
   * o grupo desenhado à mão.
   *
   * Os selos continuam chegando INTEIROS, e a filtragem acontece depois da
   * contagem: `referenceTotal` é o total do conjunto, e o selo impresso na prancha
   * diz "05/24" — a LD do tomo 1 tem de continuar dizendo isso.
   */
  folhasDoTomo?: string[];
  /**
   * Total de folhas do conjunto, dito por uma pessoa. Vence o carimbo.
   *
   * O cálculo abaixo é robusto, mas é INFERÊNCIA: quando o OCR lê "21" onde
   * está "11" na maioria das pranchas, o dominante fica errado e a LD passa a
   * numerar "05/21" — e a conferência acusa dez folhas faltando num conjunto
   * completo. Não havia canal para dizer que o carimbo mentiu; este é ele.
   */
  referenceTotal?: number;
  /**
   * A IDENTIDADE DO PROJETO dita por uma pessoa — os MESMOS campos que a capa
   * recebe, e pelo mesmo motivo: capa e LD do mesmo volume imprimem a mesma
   * obra, o mesmo código e a mesma revisão. Corrigir só num dos dois faria dois
   * documentos do mesmo conjunto discordarem entre si.
   *
   * Vazio/ausente = "use o que o carimbo disse".
   */
  orgao?: string;
  obra?: string;
  fase?: string;
  codigo?: string;
  revisao?: string;
}

/**
 * Monta uma proposta de LD a partir dos selos lidos das pranchas. Determinístico:
 * o engenheiro revisa/confirma antes de gerar. `numTomos` > 1 divide as folhas em
 * tomos balanceados (o motor `ld-generation` cria uma seção "(TOMO N)" por tomo).
 * A folha vem do CARIMBO (ARQUIVO), o total é o DOMINANTE (resiste a OCR ruim), a
 * descrição é limpa dos rótulos do carimbo, e não-pranchas são filtradas.
 */
export function buildLdProposal(
  selos: SeloForLd[],
  opts: BuildLdOptions = {},
): LdProposal {
  // Tomo específico (replicar 1 tomo) tem prioridade sobre dividir-em-N.
  const tomoNumero = Math.max(0, Math.floor(opts.tomoNumero ?? 0));
  const numTomos = tomoNumero > 0 ? 1 : Math.max(1, Math.floor(opts.numTomos ?? 1));
  const tomoInicial = Math.max(1, Math.floor(opts.tomoInicial ?? 1) || 1);
  // Qual tomo esta LD é. Só vale com divisão real (numTomos > 1).
  const tomoAtual =
    numTomos > 1 ? Math.min(numTomos, Math.max(0, Math.floor(opts.tomoAtual ?? 0))) : 0;
  const validos = selos.filter((s) => (s.fileName || s.arquivo) && isPranchaSelo(s));

  // A correção à mão vence o parser, campo a campo. Mesma regra da capa e do
  // nº da folha: entre o que foi inferido e quem olhou a prancha, ganha quem viu.
  const dito = (valor: string | undefined) => valor?.trim() || "";

  // Identidade: preferir o código do CARIMBO (per-prancha).
  const parsedList = validos.map(parseSelo);
  const codigo = dito(opts.codigo) || mode(parsedList.map((p) => p.codigo)) || "";
  const revisao = dito(opts.revisao) || mode(parsedList.map((p) => p.revisao)) || "a";

  const discCode =
    mode(parsedList.flatMap((p) => p.disciplinas)) ||
    mode(validos.map((s) => s.disciplina)).toLowerCase();
  const discLabel = (disciplinaLabel(discCode) ?? (discCode || "GERAL")).toUpperCase();

  const obra = dito(opts.obra) || mode(validos.map((s) => s.obra));
  const cliente = dito(opts.orgao) || mode(validos.map((s) => s.cliente));
  const fase = dito(opts.fase) || mode(validos.map((s) => s.fase)) || "PROJETO EXECUTIVO";

  // Folha RESOLVIDA (reconciliação por ordem de página em PDF combinado). Roda
  // sobre TODOS os selos de propósito: a reconciliação é por ordem de página no
  // documento inteiro, e fatiar antes inventaria outra numeração.
  const resolvedSheets = resolveSheetNumbers(validos);

  /*
   * A POPULAÇÃO DO TOTAL É A QUE VAI SER LISTADA, e quem manda nela é o carimbo.
   *
   * Antes o total saía de todos os selos, antes de qualquer fatia. Num volume de
   * uma disciplina só dá no mesmo; num MISTO, `validos.length` é o volume
   * inteiro e vence — a LD do bloco SPDA saía `01/20` enquanto a prancha dizia
   * `01/04`. A lista discordava do desenho que ela lista, e 6 dos 8 volumes
   * reais do escritório são mistos.
   *
   * Restringir à seleção honra os DOIS casos porque o carimbo é a verdade:
   *
   *   · TOMO de uma disciplina — as 12 folhas do tomo 1 continuam trazendo
   *     `total: 24` no selo, então o denominador segue /24, como tem de ser;
   *   · BLOCO de um volume misto — as 4 folhas do SPDA trazem `total: 4`.
   *
   * Sem fatia, a seleção é o conjunto inteiro e nada muda.
   */
  const daSelecao = opts.folhasDoTomo?.length
    ? (() => {
        const alvo = new Set(opts.folhasDoTomo);
        return validos
          .map((s, i) => ({ selo: s, sheet: resolvedSheets[i] }))
          .filter(({ selo }) => alvo.has(`${selo.fileName}#${selo.pageNumber ?? "?"}`));
      })()
    : validos.map((s, i) => ({ selo: s, sheet: resolvedSheets[i] }));
  // Uma fatia que não casa com nada não pode zerar o total: cai no conjunto.
  const populacao = daSelecao.length > 0 ? daSelecao : validos.map((s, i) => ({ selo: s, sheet: resolvedSheets[i] }));

  // Total de referência ROBUSTO: total DOMINANTE (o /TT mais frequente — resiste a
  // um total mal-lido isolado) OU a maior folha real OU a contagem. NÃO é o max de
  // números soltos (que inflava e inventava folhas faltando).
  const dominantTotal = modeNumber(
    populacao.map((p) => p.selo.total).filter((t): t is number => typeof t === "number"),
  );
  const sheets = populacao
    .map((p) => p.sheet)
    .filter((n): n is number => n != null && n > 0);
  const maxSheet = sheets.length ? Math.max(...sheets) : 0;
  // A precedência (manual vence a inferência, inclusive para menos) mora no
  // módulo puro, que é onde ela pode ser testada com node cru.
  const referenceTotal = totalDeReferencia(
    Math.max(dominantTotal, maxSheet, populacao.length),
    opts.referenceTotal,
  );

  // Cada linha viaja com o ID da folha (`arquivo#pagina`) até a hora de fatiar —
  // é ele que liga a linha à decisão que o canvas tomou.
  const todasAsLinhas = validos.map((s, i) => {
    const n = resolvedSheets[i];
    const sheet =
      n != null && n > 0
        ? referenceTotal > 0
          ? formatSheet(n, referenceTotal) // padding largura-do-total
          : String(n).padStart(2, "0")
        : "";
    return {
      id: `${s.fileName}#${s.pageNumber ?? "?"}`,
      row: {
        sheet,
        // Coluna ARQUIVOS = campo ARQUIVO do carimbo (código da prancha).
        file: s.arquivo?.trim() || s.fileName,
        // Descrição limpa dos rótulos do carimbo (IMP/DATA/REV...) — motor provado
        // do módulo LD original, agora compartilhado em lib/ld/stamp-parsing.
        description: cleanStampDescription(s.conteudo || s.tituloSecao || ""),
        readDiscipline: rowDisciplineLabel(s),
      },
    };
  });

  /*
   * Ordem das linhas. O padrão é o número do carimbo — é o que a LD sempre fez, e
   * mudá-lo mexeria no resultado de todo projeto que nunca foi arrastado. Quando
   * o usuário reordenou folhas no canvas, o cliente pede `respeitarOrdem` e a
   * ordem em que os selos chegaram (a da projeção) é que vale.
   */
  if (!opts.respeitarOrdem) {
    todasAsLinhas.sort((a, b) => sheetOrder(a.row.sheet) - sheetOrder(b.row.sheet));
  }

  /*
   * Fatia do tomo. Cada tomo é um volume físico: a LD do tomo 1 lista as folhas
   * 1-12, a do tomo 2 lista 13-24.
   *
   * `referenceTotal` NÃO muda — continua sendo o total do conjunto. O selo
   * impresso na prancha diz "05/24", e a LD do tomo 1 tem que continuar dizendo
   * isso; trocar para "05/12" faria a lista discordar do próprio desenho.
   */
  const idsDoTomo = opts.folhasDoTomo?.length ? new Set(opts.folhasDoTomo) : null;
  const faixa =
    !idsDoTomo && tomoAtual > 0
      ? faixasDosTomos(todasAsLinhas.length, numTomos)[tomoAtual - 1]
      : null;
  const selecionadas = idsDoTomo
    ? // O canvas decidiu quem é deste tomo. A ordem é a que já está em
      // `todasAsLinhas`: carimbo por padrão, projeção quando `respeitarOrdem`.
      todasAsLinhas.filter((l) => idsDoTomo.has(l.id))
    : faixa
      ? todasAsLinhas.slice(faixa.inicio - 1, faixa.fim)
      : todasAsLinhas;
  const rows = selecionadas.map((l) => l.row);

  /*
   * Título da seção, em ordem de autoridade:
   *
   *   1. o que o engenheiro DISSE — decisão, e decisão não se adivinha;
   *   2. o NOME PADRÃO da disciplina, do léxico ([[disciplinas.ts]]);
   *   3. o palpite do selo (descartando órgão/secretaria);
   *   4. "PROJETO <rótulo de tela>", que é o último recurso.
   *
   * O nome padrão passou à frente do palpite do selo quando os nomes viraram
   * fonte única: ele é o que o escritório IMPRIME, lido de 91 capas e
   * separatrizes reais. O `tituloSecao` sai de OCR e varia de projeto para
   * projeto — serve para disciplina que o léxico não conhece, não para
   * contradizer o padrão.
   *
   * Remove "(TOMO ...)" digitado; o tomo é anexado a seguir (específico) ou por
   * faixa pelo ld-generation (dividir-em-N).
   */
  const tituloBase = (
    opts.tituloLd?.trim() ||
    nomeNoDocumento(discCode) ||
    mode(
      validos.map((s) =>
        s.tituloSecao && !isOrgaoLike(s.tituloSecao) ? s.tituloSecao : null,
      ),
    ) ||
    `PROJETO ${discLabel}`
  )
    .replace(/\s*\(\s*tomo[^)]*\)\s*$/i, "")
    .trim();
  // Tomo único, mas numerado: seja por tomo específico, seja por contagem
  // deslocada (1 tomo começando no 04), a seção precisa dizer qual tomo é.
  const tomoUnicoRotulado =
    tomoNumero > 0
      ? tomoNumero
      : // Este documento É um tomo: rotula com o número dele no volume.
        tomoAtual > 0
        ? tomoInicial + tomoAtual - 1
        : numTomos === 1 && tomoInicial > 1
          ? tomoInicial
          : 0;
  const sectionTitle =
    tomoUnicoRotulado > 0
      ? `${tituloBase} (TOMO ${String(tomoUnicoRotulado).padStart(2, "0")})`
      : tituloBase;

  // Tomos: divide as folhas em N faixas balanceadas (motor provado do módulo LD).
  // Seções internas por tomo só existem no documento ÚNICO (comportamento
  // antigo). Quando esta LD já É um tomo, ela não se subdivide de novo.
  const tomosBase: Tomo[] =
    tomoAtual === 0 && numTomos > 1 && referenceTotal > 0
      ? buildBalancedTomos(referenceTotal, numTomos)
      : [];
  // Contagem deslocada: as FAIXAS de folhas não mudam — só os rótulos avançam,
  // porque a numeração é do volume. O motor do módulo LD sempre rotula a partir
  // de 1, e não é mexido aqui (ele é compartilhado com a tela de LD).
  const tomos: Tomo[] =
    tomoInicial > 1
      ? tomosBase.map((t, i) => ({
          ...t,
          id: tomoInicial + i,
          title: `TOMO ${tomoInicial + i}`,
        }))
      : tomosBase;

  const input: CreateLDInput = {
    ldData: {
      projectCode: codigo,
      formattedCode: codigo,
      discipline: discLabel,
      revision: revisao,
      sectionTitle,
      client: cliente,
      workName: obra,
      phase: fase,
    },
    rows,
    tomos,
    referenceTotal,
    // Proposta: não bloqueia na geração; a UI mostra os avisos e o engenheiro decide.
    enforceValidation: false,
  };

  return {
    input,
    resumo: {
      disciplina: discLabel,
      disciplinaCode: discCode,
      codigo,
      revisao,
      obra,
      totalFolhas: rows.length,
    },
  };
}
