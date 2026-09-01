/**
 * Auditoria do MEMORIAL contra a obra das pranchas (caso raro do fluxo Nexo).
 * REUSA o motor de auditoria existente (`/api/audit`) — não reimplementa nada.
 *
 * Sacada: o Nexo já conhece a IDENTIDADE (obra/código do carimbo, prefeitura do
 * template escolhido). Ele passa isso como GABARITO (ground truth) para a
 * auditoria, que então pega de graça o erro que originou o projeto: um memorial
 * emitido com o nome/dados de OUTRA obra.
 */
/*
 * CAMINHO RELATIVO COM `.ts`, e não o alias `@/` — como em [[blocos.ts]].
 *
 * Este módulo é importado direto por `scripts/test-nexo-audit-contrato.ts` e
 * `test-nexo-audit-desconexao.ts`, que rodam em node cru (type-stripping, sem
 * bundler). Ali o alias `@/` não existe: só o Next o resolve. Os outros imports
 * daqui são `import type` e somem no strip — este é de VALOR e ficaria,
 * derrubando os dois testes com ERR_MODULE_NOT_FOUND.
 */
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";
import type { AuditReport } from "@/lib/audit-report";
import type { EmitirMarco, MarcoDaAuditoria } from "@/lib/audit-progress";

export interface MemorialAuditGabarito {
  obra?: string;
  prefeitura?: string;
  municipio?: string;
  /**
   * O CENTRO DE CUSTO lido do documento ("084_25").
   *
   * Já era usado para resolver a que projeto a auditoria pertence (ver
   * [[projeto-da-auditoria.ts]]), mas nunca acompanhava a chamada — e por isso
   * nunca chegava ao banco. É metade do nome pelo qual o escritório procura uma
   * auditoria; a outra metade é a prefeitura.
   */
  centroCusto?: string;
}

export type MemorialAuditLevel = "standard" | "deep";

export interface MemorialAuditResult {
  /** O parecer estruturado — é o que a tela de relatório consome. */
  report: AuditReport;
  /** O mesmo parecer em texto corrido, para copiar/exportar. */
  texto: string;
  /** Id persistido; sem ele o feedback por achado não tem onde gravar. */
  auditId: string | null;
  /**
   * Os arquivos auditados, com a chave do que está guardado no servidor.
   *
   * OPCIONAL, e é o caso comum estar ausente: `postAudit` devolve o que
   * `/api/audit` responde (`result`, `report`, `auditId`), e quem acabou de
   * rodar a auditoria tem o memorial no IndexedDB de qualquer forma. Quem
   * precisa disto é quem chega por `consultarAuditoria` — pelo link do e-mail,
   * sem o arquivo na máquina.
   *
   * Ausente também nos artefatos gravados ANTES deste trabalho.
   * `fonteDoDocumento` trata os dois casos do mesmo jeito, e a tela diz o motivo.
   */
  arquivos?: { fileName: string; checksumSha256: string | null }[];
}

/**
 * Roda a auditoria do memorial. `level` "deep" é mais completa (mais tokens).
 *
 * CONTRATO: `/api/audit` responde `{ result, report, auditId }`, onde `result` é
 * o relatório em TEXTO e `report` é o objeto. Ler `result` como se fosse o objeto
 * — o que esta função fazia — grava uma string onde o relatório deveria estar, e
 * a tela quebra ao contar os achados. O teste em `audit-contrato.test.ts` casa os
 * dois lados justamente porque `tsc` não vê através de um `as`.
 */
/**
 * A CONEXÃO caiu — a auditoria não.
 *
 * Existe para separar dois fracassos que a tela tratava igual: "o motor falhou"
 * (acabou, e está gravado como FAILED) e "perdi o fio" (o servidor continua
 * analisando e vai gravar o parecer). No segundo caso o bilhete de retomada tem
 * de FICAR — apagá-lo joga fora minutos de modelo já pagos e obriga a rodar de
 * novo, que foi o que aconteceu em 12/08/2026.
 */
export class AuditoriaDesconectada extends Error {
  constructor() {
    super(
      "A conexão com o servidor caiu, mas a análise continua lá. O resultado aparece aqui sozinho quando terminar.",
    );
    this.name = "AuditoriaDesconectada";
  }
}

export interface MemorialAuditOpcoes {
  /** Recebe os marcos REAIS do motor. Passar isto liga o modo de fluxo. */
  onMarco?: EmitirMarco;
  /** Desiste da auditoria. O trabalho já pago no servidor segue até o fim. */
  signal?: AbortSignal;
  /**
   * Id escolhido pelo CLIENTE, antes de começar.
   *
   * É o que torna a auditoria reencontrável: guardado junto da conversa, permite
   * voltar depois de um F5 e perguntar ao servidor o que aconteceu, em vez de
   * jogar fora os minutos de modelo que já foram pagos.
   */
  auditId?: string;
  /**
   * O PROJETO da auditoria. Obrigatorio desde que `/api/audit` passou a exigi-lo:
   * parecer sem projeto nao tem fila, gate de emissao nem a quem atribuir achado.
   *
   * Opcional no TIPO porque quem resolve o endereco e quem chama — ver
   * [[projeto-da-auditoria.ts]] —, e a rota recusa por conta propria se vier
   * vazio. Duas guardas, e a do servidor e a que vale.
   */
  projectId?: string;
  /**
   * A auditoria ANTERIOR deste memorial nesta conversa.
   *
   * O servidor compara as impressões digitais por capítulo e relê só o que
   * mudou. O cliente já conhecia esse id — ele já o mandava para
   * `/api/audit/delta`, que responde de graça o que mudou. Faltava mandá-lo
   * para cá, onde a resposta vira economia em vez de só informação.
   */
  auditIdAnterior?: string;
}

export async function runMemorialAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
  conversationId?: string | null,
  opcoes: MemorialAuditOpcoes = {},
): Promise<MemorialAuditResult> {
  const form = new FormData();
  form.append(
    "message",
    "Auditoria do memorial descritivo contra a obra declarada das pranchas.",
  );
  form.append("auditMode", "memorial");
  form.append("analysisLevel", level);
  form.append("files", memorial, memorial.name);
  form.append("fileTypes", "memorial");
  /*
   * IDENTIDADE da auditoria no histórico.
   *
   * O Nexo não mandava nada disso, e como ele é o único caminho hoje, TODA
   * auditoria era gravada anônima: o painel administrativo listava dezenas de
   * "Auditoria sem identificação · Projeto não informado", inútil para achar
   * qualquer coisa. A obra já está aqui, no gabarito — só não estava sendo
   * enviada. Sem obra, o nome do arquivo ainda é melhor que nada.
   */
  const obraGabarito = gabarito.obra?.trim();
  /*
   * `084_25-CRICIUMA` — centro de custo e prefeitura, que é como o escritório
   * chama uma auditoria. A obra vinha no lugar dele: correta, mas longa demais
   * para uma lista e quase idêntica entre obras do mesmo programa. Sem as duas
   * metades a função devolve "" e a identidade cai para a obra, como antes.
   */
  const centroCusto = centroDeCustoDaAuditoria(
    gabarito.centroCusto,
    gabarito.prefeitura || gabarito.municipio,
  );
  form.append("auditTitle", centroCusto || obraGabarito || memorial.name);
  // A obra continua indo em `projectName`: o par título/projeto na lista fica
  // "084_25-CRICIUMA · Reforma e Adequação da Emeb...", que é o código para
  // achar e o nome para reconhecer. Trocar os dois pelo mesmo valor perderia um.
  if (obraGabarito) form.append("projectName", obraGabarito);
  if (gabarito.centroCusto?.trim()) {
    form.append("gabaritoCentroCusto", gabarito.centroCusto.trim());
  }
  if (gabarito.obra?.trim()) form.append("gabaritoObra", gabarito.obra.trim());
  if (gabarito.prefeitura?.trim()) {
    form.append("gabaritoPrefeitura", gabarito.prefeitura.trim());
  }
  if (gabarito.municipio?.trim()) {
    form.append("gabaritoMunicipio", gabarito.municipio.trim());
  }
  // Carimba a conversa do Nexo no consumo de IA desta auditoria (anel de consumo).
  if (conversationId) form.append("conversationId", conversationId);

  if (opcoes.onMarco) form.append("stream", "1");
  if (opcoes.auditId) form.append("auditId", opcoes.auditId);
  if (opcoes.projectId) form.append("projectId", opcoes.projectId);
  if (opcoes.auditIdAnterior) form.append("auditIdAnterior", opcoes.auditIdAnterior);

  let res: Response;
  try {
    res = await fetch("/api/audit", {
      method: "POST",
      body: form,
      signal: opcoes.signal,
    });
  } catch (err) {
    // Desistência do usuário passa direto: quem trata `AbortError` é quem chamou.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new AuditoriaDesconectada();
  }

  /*
   * DOCUMENTO IDÊNTICO — recusa, e ela vem ANTES da leitura do fluxo.
   *
   * O servidor devolve 409 com um corpo JSON simples quando nada mudou desde a
   * última auditoria. Em modo de fluxo, `lerFluxo` procuraria `done`/`error`
   * num corpo que não é fluxo, não acharia, e devolveria `null` — a tela diria
   * "a conexão caiu" para uma recusa deliberada, e ainda guardaria um bilhete de
   * retomada para uma auditoria que nunca começou.
   */
  if (res.status === 409) {
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? "O documento é idêntico ao que já foi auditado.");
  }

  const payload = opcoes.onMarco
    ? await lerFluxo(res, opcoes.onMarco)
    : ((await res.json().catch(() => null)) as RespostaDaAuditoria | null);

  /*
   * FLUXO CORTADO ≠ AUDITORIA FALHADA.
   *
   * Em modo de fluxo, um `payload` nulo significa que o corpo acabou sem `done`
   * nem `error` — a conexão caiu no meio. O servidor NÃO parou: ele termina e
   * grava o parecer (foi assim que uma análise de 39 achados ficou pronta no
   * banco enquanto a tela mostrava "network error"). Quem chamou precisa saber
   * a diferença para GUARDAR o bilhete de retomada em vez de jogá-lo fora.
   */
  if (opcoes.onMarco && payload === null) throw new AuditoriaDesconectada();

  if (!payload?.report) {
    throw new Error(payload?.error ?? "Falha na auditoria do memorial.");
  }
  return {
    report: payload.report,
    texto: typeof payload.result === "string" ? payload.result : "",
    auditId: payload.auditId ?? null,
  };
}

interface RespostaDaAuditoria {
  error?: string;
  result?: string;
  report?: AuditReport;
  auditId?: string | null;
}

/** O que o servidor sabe sobre uma auditoria já disparada. */
export type EstadoDaAuditoria =
  | { situacao: "rodando" }
  | { situacao: "pronta"; resultado: MemorialAuditResult }
  | { situacao: "falhou"; motivo: string }
  | { situacao: "irrecuperavel"; motivo: string };

/**
 * Pergunta ao servidor o que aconteceu com uma auditoria disparada antes.
 *
 * `irrecuperavel` é a resposta honesta para "não dá para saber": ambiente sem
 * banco não guarda auditoria nenhuma, e id desconhecido não vai aparecer depois.
 * Sem essa distinção a interface ficaria perguntando para sempre por algo que
 * nunca chega.
 */
export async function consultarAuditoria(auditId: string): Promise<EstadoDaAuditoria> {
  const res = await fetch(`/api/audits/${encodeURIComponent(auditId)}`);
  if (res.status === 404) {
    return { situacao: "irrecuperavel", motivo: "Auditoria não encontrada no servidor." };
  }
  const corpo = (await res.json().catch(() => null)) as
    | {
        status?: string;
        report?: AuditReport | null;
        result?: string;
        error?: string | null;
        arquivos?: { fileName: string; checksumSha256: string | null }[];
      }
    | null;
  if (!res.ok || !corpo) {
    // Banco fora do ar é temporário: vale continuar tentando.
    return { situacao: "rodando" };
  }
  if (corpo.status === "SEM_HISTORICO") {
    return {
      situacao: "irrecuperavel",
      motivo: "Este ambiente não guarda histórico de auditoria.",
    };
  }
  if (corpo.status === "COMPLETED" && corpo.report) {
    return {
      situacao: "pronta",
      resultado: {
        report: corpo.report,
        texto: corpo.result ?? "",
        auditId,
        arquivos: corpo.arquivos ?? [],
      },
    };
  }
  if (corpo.status === "FAILED") {
    return { situacao: "falhou", motivo: corpo.error ?? "A auditoria falhou no servidor." };
  }
  return { situacao: "rodando" };
}

/**
 * Lê o fluxo de eventos do motor: `marco` durante, `done`/`error` no fim.
 *
 * O corte é por linha em branco, não por pedaço da rede: um evento pode chegar
 * partido em dois `read()`, e tratar cada pedaço como uma mensagem completa faz
 * o `JSON.parse` explodir no meio de uma auditoria de seis minutos.
 */
async function lerFluxo(
  res: Response,
  onMarco: EmitirMarco,
): Promise<RespostaDaAuditoria | null> {
  const leitor = res.body?.getReader();
  if (!leitor) return null;
  const decodificador = new TextDecoder();
  let sobra = "";
  let final: RespostaDaAuditoria | null = null;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    sobra += decodificador.decode(value, { stream: true });
    const blocos = sobra.split("\n\n");
    sobra = blocos.pop() ?? "";
    for (const bloco of blocos) {
      const evento = /^event: (.+)$/m.exec(bloco)?.[1]?.trim();
      const dadosBrutos = /^data: (.*)$/m.exec(bloco)?.[1];
      if (!evento || dadosBrutos === undefined) continue;
      let dados: unknown;
      try {
        dados = JSON.parse(dadosBrutos);
      } catch {
        continue;
      }
      if (evento === "marco") onMarco(dados as MarcoDaAuditoria);
      else if (evento === "done" || evento === "error") {
        final = dados as RespostaDaAuditoria;
      }
    }
  }
  return final;
}

/**
 * A AUDITORIA QUE ESTÁ NA TELA — a MAIS RECENTE desta conversa.
 *
 * Era `results.find(...)` dentro de `PalcoDoNexo`, e virou função porque ganhou
 * um segundo consumidor: o chat precisa responder sobre o MESMO parecer que a
 * tela mostra. Duas cópias da regra discordariam no dia em que alguém
 * reauditasse — `saveResult` acrescenta um artefato novo sem apagar o anterior,
 * e a lista passa a ter dois.
 *
 * `generatedAt` é o critério, e não a posição no vetor: regerar um artefato
 * existente o substitui NO LUGAR, mantendo a posição antiga e atualizando o
 * carimbo.
 */
export function auditoriaMaisRecente(
  results: readonly {
    kind: string;
    payload?: unknown;
    generatedAt?: number;
    artifactId: string;
  }[],
): { artifactId: string; salvo: MemorialAuditResult } | null {
  const auditorias = results
    .filter((r) => r.kind === "auditoria")
    .slice()
    .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0));

  const ultima = auditorias.at(-1);
  if (!ultima?.payload) return null;

  return { artifactId: ultima.artifactId, salvo: ultima.payload as MemorialAuditResult };
}
