/**
 * O PARECER ANTERIOR SERVE DE BASE PARA REUSO?
 *
 * Separado de [[audit-reuso.ts]] porque responde outra pergunta: aquele decide
 * O QUE RELER dado que a base presta; este decide SE ELA PRESTA.
 *
 * O portão que importa é `analise-parcial`. Em 17/08/2026 uma auditoria do
 * memorial 084_25 truncou 20 dos 25 blocos por estouro do teto de saída. Se o
 * reuso estivesse ligado, a reauditoria seguinte herdaria capítulos que nunca
 * foram lidos de verdade — e o buraco viraria permanente, porque cada corrida
 * confirmaria o vazio da anterior. Reuso AMPLIFICA a base: base furada, furo
 * maior.
 *
 * Recusar NÃO é erro. A auditoria roda inteira, como sempre rodou, e o parecer
 * diz por que não houve reuso.
 *
 * PURO: recebe o parecer já carregado. Quem fala com o banco é a rota.
 */
import type { AuditReport, CapituloImpresso } from "./audit-report.ts";
import { paginasMudasPendentes } from "./resumo-do-esforco.ts";

export type BaseDaReauditoria = {
  auditId: string;
  /** `status` da linha `Audit` — só "COMPLETED" afirma alguma coisa. */
  status: string;
  report: AuditReport | null;
};

export type MotivoDeRecusa =
  | "sem-base"
  | "nao-completou"
  | "analise-parcial"
  | "sem-impressao"
  | "versao-diferente"
  | "outro-arquivo"
  | "paginas-nao-lidas";

export type Elegibilidade =
  | { serve: true; impressao: CapituloImpresso[] }
  | { serve: false; motivo: MotivoDeRecusa };

export function avaliarBase(args: {
  base: BaseDaReauditoria | null;
  /** Nome do arquivo QUE ESTÁ SENDO auditado agora. */
  arquivo: string;
  versaoAtual: string;
}): Elegibilidade {
  const { base, arquivo, versaoAtual } = args;

  if (!base || !base.report) {
    return { serve: false, motivo: "sem-base" };
  }

  if (base.status !== "COMPLETED") {
    return { serve: false, motivo: "nao-completou" };
  }

  const runtime = base.report.runtime;

  if ((runtime?.passadas_incompletas?.length ?? 0) > 0) {
    return { serve: false, motivo: "analise-parcial" };
  }

  /*
   * Comparação de STRING contra STRING. Parecer anterior a esta mudança gravou
   * o número 1; `String(1) !== hash` recusa sozinho, sem caso especial.
   */
  if (String(runtime?.versao_auditor ?? "") !== versaoAtual) {
    return { serve: false, motivo: "versao-diferente" };
  }

  /*
   * FOLHA QUE NINGUÉM LEU TAMBÉM FURA A BASE — e não aparece em
   * `passadas_incompletas`.
   *
   * O portão acima cobre a passada que FALHOU. Uma auditoria cujas folhas estão
   * desenhadas em vez de escritas (ver [[pagina-muda.ts]]) não falha em nada: a
   * global roda, os blocos rodam, e ela sai "COMPLETED". No
   * `114_19_VOLUME ÚNICO.pdf` isso seria uma base que leu 6 de 31 páginas —
   * e herdar dela é o mesmo congelamento de buraco descrito no cabeçalho, pela
   * porta ao lado.
   *
   * Só conta a folha que ficou POR LER: transcrita é folha lida.
   */
  const doArquivoNaCobertura = acharPorNomeOuChave(
    base.report.arquivos_analisados ?? [],
    arquivo,
  );
  if (doArquivoNaCobertura?.cobertura && paginasMudasPendentes(doArquivoNaCobertura.cobertura) > 0) {
    return { serve: false, motivo: "paginas-nao-lidas" };
  }

  if (!runtime?.impressao?.length) {
    return { serve: false, motivo: "sem-impressao" };
  }

  const doArquivo = acharPorNomeOuChave(runtime.impressao, arquivo);

  if (!doArquivo?.capitulos?.length) {
    return { serve: false, motivo: "outro-arquivo" };
  }

  return { serve: true, impressao: doArquivo.capitulos };
}

/**
 * A CHAVE DO DOCUMENTO: o nome sem a revisão nem o rastro das assinaturas.
 *
 * `impressao` é gravada por NOME de arquivo, e o nome muda entre revisões do
 * MESMO documento — por convenção do escritório, e não por descuido. Medido nos
 * nomes reais do acervo:
 *
 *   040_26_md_geral_a.pdf
 *   040_26_md_geral_a_clau_chris_assinado.pdf
 *   040_26_md_geral_a_clau_chris_Rama_Rafa_assinado.pdf
 *   116_25_md_geral_b.pdf
 *
 * A letra de revisão está no nome, e cada rodada de assinatura ACRESCENTA quem
 * assinou. Casando só por nome exato, o reuso recusava `_a` -> `_b` — que é
 * exatamente a reauditoria de revisão para a qual ele foi construído.
 *
 * A regra: os tokens ATÉ o primeiro que é uma letra sozinha (a revisão) ou um
 * `rev`/`r00`. Tudo depois é rastro de processo, não identidade do documento.
 * `116_25_md_geral` e `116_25_md_ter_pav` continuam chaves diferentes, que é o
 * que impede herdar achado de outra peça do mesmo projeto.
 */
export function chaveDoDocumento(fileName: string): string {
  const stem = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/, "");
  const tokens = stem.split(/[^a-z0-9]+/).filter(Boolean);
  const corte = tokens.findIndex((t) => /^[a-z]$/.test(t) || /^r(ev|\d+)$/.test(t));
  return (corte >= 0 ? tokens.slice(0, corte) : tokens).join("_");
}

/**
 * A impressão DESTE documento dentro da base — por nome exato, e só então pela
 * chave.
 *
 * A chave normalizada só vale quando ela casa com UMA candidata. As seis folhas
 * de `113_22_gme_a-R00 - NN - …` normalizam todas para `113_22_gme`; com mais
 * de uma, escolher seria escolher no escuro, e a recusa é o comportamento que
 * já existia.
 */
export function acharPorNomeOuChave<T extends { arquivo: string }>(
  entradas: readonly T[],
  arquivo: string,
): T | undefined {
  const exato = entradas.find((i) => i.arquivo === arquivo);
  if (exato) return exato;

  const chave = chaveDoDocumento(arquivo);
  if (!chave) return undefined;

  const candidatas = entradas.filter((i) => chaveDoDocumento(i.arquivo) === chave);
  return candidatas.length === 1 ? candidatas[0] : undefined;
}

/*
 * A MESMA busca serve às TRÊS leituras da base — a cobertura, a impressão e o
 * delta que o cartão mostra ANTES de auditar (`/api/audit/delta`).
 *
 * O delta tinha regra própria: nome exato, senão `impressaoAnterior[0]`. Mais
 * frouxa que a daqui, e a divergência aparecia do pior jeito possível — numa
 * revisão renomeada o cartão dizia "86% já foi lido" e a auditoria em seguida
 * recusava a base por `outro-arquivo` e relia tudo. A promessa e a entrega
 * discordando sobre a mesma dupla de arquivos.
 *
 * Foi o defeito do primeiro corte desta função: a impressão casava pela chave
 * (para a revisão `_a` -> `_b` reusar) e a cobertura casava por nome exato. Numa
 * revisão renomeada, o arquivo da cobertura não era encontrado, o portão da
 * folha muda achava que não havia medição e passava — deixando entrar
 * exatamente a base furada que ele acabara de ser escrito para barrar.
 */

/**
 * Por que não houve reuso, em linguagem de documento. Nenhuma frase diz "erro":
 * não houve erro nenhum — houve ausência de base comparável, e a auditoria
 * completa é o desfecho normal, não a punição.
 */
export function fraseDaRecusa(motivo: MotivoDeRecusa): string {
  switch (motivo) {
    case "sem-base":
      return "Primeira auditoria deste memorial: não há parecer anterior para comparar.";
    case "nao-completou":
      return "A auditoria anterior não chegou ao fim, então não serve de referência.";
    case "analise-parcial":
      return "A auditoria anterior ficou parcial — parte do documento não foi lida. Este memorial foi lido inteiro de novo.";
    case "sem-impressao":
      return "O parecer anterior é de uma versão que ainda não guardava a impressão por capítulo.";
    case "versao-diferente":
      return "O auditor mudou desde o parecer anterior (prompt, modelo ou recorte), então o documento foi lido inteiro.";
    case "paginas-nao-lidas":
      return "A auditoria anterior deixou folhas sem leitura — o texto delas está desenhado na página, não escrito, e não foi transcrito. Herdar dela repetiria o buraco, então este memorial foi lido inteiro.";
    case "outro-arquivo":
      return "O parecer anterior é de outro arquivo; não há capítulos para comparar.";
  }
}
