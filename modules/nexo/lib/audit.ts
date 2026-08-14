/**
 * Auditoria do MEMORIAL contra a obra das pranchas (caso raro do fluxo Nexo).
 * REUSA o motor de auditoria existente (`/api/audit`) — não reimplementa nada.
 *
 * Sacada: o Nexo já conhece a IDENTIDADE (obra/código do carimbo, prefeitura do
 * template escolhido). Ele passa isso como GABARITO (ground truth) para a
 * auditoria, que então pega de graça o erro que originou o projeto: um memorial
 * emitido com o nome/dados de OUTRA obra.
 */
import type { AuditReport } from "@/lib/audit-report";
import type { EmitirMarco, MarcoDaAuditoria } from "@/lib/audit-progress";

export interface MemorialAuditGabarito {
  obra?: string;
  prefeitura?: string;
  municipio?: string;
}

export type MemorialAuditLevel = "standard" | "deep";

export interface MemorialAuditResult {
  /** O parecer estruturado — é o que a tela de relatório consome. */
  report: AuditReport;
  /** O mesmo parecer em texto corrido, para copiar/exportar. */
  texto: string;
  /** Id persistido; sem ele o feedback por achado não tem onde gravar. */
  auditId: string | null;
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
  form.append("auditTitle", obraGabarito || memorial.name);
  if (obraGabarito) form.append("projectName", obraGabarito);
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
    | { status?: string; report?: AuditReport | null; result?: string; error?: string | null }
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
      resultado: { report: corpo.report, texto: corpo.result ?? "", auditId },
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
