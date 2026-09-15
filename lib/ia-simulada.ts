/**
 * IA SIMULADA — o modelo falso da bateria de fluxos.
 *
 * Existe para testar o FLUXO sem pagar o modelo: em 14/09/2026 sete defeitos do
 * 117_25 apareceram fora do caminho feliz (leitura abortada, revisão truncada,
 * reauditar, F5), e nenhum dependia do que o modelo responde — dependiam de ele
 * responder, demorar ou falhar. Ver
 * `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md`.
 *
 * PURO e sem alias: o teste em node cru o importa, e `lib/ai-runner.ts` só o
 * carrega quando `iaSimuladaLigada()`.
 *
 * Operação sem simulação QUEBRA ALTO. Uma chamada nova no produto que passasse
 * calada pela bateria seria um fluxo sem teste fingindo que tem.
 */

export type ComportamentoSimulado =
  | "abortar"
  | "truncar"
  | "503"
  | "recusar"
  | "json-invalido"
  | `lento:${number}`;

export type RespostaSimulada = {
  id: string;
  status: "completed" | "incomplete";
  incomplete_details?: { reason: string };
  output_text: string;
  output: unknown[];
  usage: { input_tokens: 0; output_tokens: 0; total_tokens: 0 };
};

type Pedido = { operation: string; model: string; request: unknown };
type ItemDaFila = { operation: string; comportamento: ComportamentoSimulado };

// A chave mora num módulo sem imports, que o `ai-runner` também usa.
export { iaSimuladaLigada } from "./ia-simulada-ligada.ts";

export function comportamentoValido(texto: string): texto is ComportamentoSimulado {
  return /^(abortar|truncar|503|recusar|json-invalido|lento:\d{1,6})$/.test(texto);
}

/* O servidor da bateria é um processo só: a fila mora em `globalThis`, que
   sobrevive ao recarregamento de módulo do `next dev`. */
function estado(): { fila: ItemDaFila[] } {
  const g = globalThis as { __nexodocIaSimulada?: { fila: ItemDaFila[] } };
  g.__nexodocIaSimulada ??= { fila: [] };
  return g.__nexodocIaSimulada;
}

export function enfileirar(operation: string, comportamento: ComportamentoSimulado) {
  estado().fila.push({ operation, comportamento });
}

export function limparFila() {
  estado().fila.length = 0;
}

export function verFila(): ItemDaFila[] {
  return estado().fila.map((i) => ({ ...i }));
}

function tirarDaFila(operation: string): ComportamentoSimulado | null {
  const fila = estado().fila;
  const i = fila.findIndex((x) => x.operation === operation);
  if (i === -1) return null;
  return fila.splice(i, 1)[0].comportamento;
}

/** Todo o texto do pedido, venha ele como string ou como lista de mensagens. */
function textoDoPedido(request: unknown): string {
  const input = (request as { input?: unknown } | null)?.input;
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return "";
  return input
    .map((item) => {
      const content = (item as { content?: unknown })?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((c) => String((c as { text?: unknown })?.text ?? "")).join("\n");
      }
      return "";
    })
    .join("\n");
}

/** A fala do engenheiro dentro do prompt do agente (`server/nexo/agent/run-turn.ts`). */
function pedidoDoEngenheiro(texto: string): string {
  const m = /PEDIDO DO ENGENHEIRO:\n([\s\S]*?)\n\nFormato da resposta/.exec(texto);
  return (m?.[1] ?? texto).trim();
}

/**
 * Linhas que um achado pode citar LITERALMENTE, com a página em que estão.
 * O marcador é o de `textoDoDocumentoParaIA` (`--- PAGINA N ---`), conferido no
 * 117_25 em 14/09/2026. A evidência sai do texto real para passar pelas mesmas
 * travas que um achado de verdade passaria.
 */
function trechosAncoraveis(texto: string): { pagina: string; trecho: string }[] {
  const saida: { pagina: string; trecho: string }[] = [];
  let pagina = "1";
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    const marcador = /^---\s*P[AÁ]GINA\s+(\d+)\s*---$/i.exec(linha);
    if (marcador) {
      pagina = marcador[1];
      continue;
    }
    if (linha.length >= 40 && linha.length <= 160 && /[a-zà-ú]{4}/i.test(linha) && !/\.{5,}/.test(linha)) {
      saida.push({ pagina, trecho: linha });
    }
  }
  return saida;
}

function completa(texto: string, extra: Partial<RespostaSimulada> = {}): RespostaSimulada {
  return {
    id: `simulada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "completed",
    output_text: texto,
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: texto }] }],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    ...extra,
  };
}

function achadoSimulado(i: number, ancora: { pagina: string; trecho: string }) {
  return {
    prioridade: "Media",
    pagina: ancora.pagina,
    capitulo: "não identificado",
    local: "texto do memorial",
    tipo: `Achado simulado ${i + 1}`,
    descricao: `Achado simulado ${i + 1} da leitura global.`,
    evidencia: ancora.trecho,
    termo_busca: ancora.trecho.slice(0, 60),
    arquivo: "",
    categoria: "simulada",
    referencia_comparada: "",
    conflito: "Conflito simulado para teste de fluxo.",
    sugestao_correcao: "Revisar o trecho indicado.",
    confianca: "alta",
    impacto: "tecnico_contratual",
  };
}

/**
 * O texto do PDF que a rota do selo manda DEPOIS do prompt. O marcador é o de
 * `buildTextPrompt` (app/api/ld/extract-stamp/route.ts). Ler o pedido inteiro
 * pegaria o exemplo do próprio prompt ("ARQUIVO: 040_26_est_imp_001_a") como
 * se fosse o carimbo — foi a primeira coisa que o teste desta função pegou.
 */
function textoExtraidoDoSelo(texto: string): string {
  const marcador = "TEXTO EXTRAÍDO:\n";
  const i = texto.indexOf(marcador);
  return i === -1 ? "" : texto.slice(i + marcador.length);
}

/** Rótulo sozinho na linha ("PAGINA COMPLETA:", "ESCALA:"): não é valor de ninguém. */
const ROTULO_SOLTO = /^[A-ZÀ-Ú][A-ZÀ-Ú .()]*:\s*$/;

/**
 * O valor de um rótulo do carimbo. `textoPorPosicao` (server/nexo/selo-regiao.ts)
 * junta os itens por linha: o valor vem na mesma linha ("ARQUIVO: x") quando
 * rótulo e valor dividem a altura, e na linha de baixo quando o valor fica sob
 * o rótulo, como no carimbo da família `est`.
 */
function valorDoRotulo(linhas: readonly string[], rotulo: RegExp): string | null {
  for (let i = 0; i < linhas.length; i++) {
    const m = rotulo.exec(linhas[i]);
    if (!m) continue;
    const resto = linhas[i].slice(m[0].length).trim();
    if (resto) return resto;
    const proxima = linhas.slice(i + 1).find((l) => l.trim() !== "")?.trim() ?? "";
    return proxima && !ROTULO_SOLTO.test(proxima) ? proxima : null;
  }
  return null;
}

/** Mesma convenção de `CODIGO_DE_PRANCHA` (server/nexo/selo-regiao.ts). */
const CODIGO_DE_PRANCHA = /\b\d{2,4}[_-]\d{2}[_a-z0-9.]*[_-]\d{2,3}[_-][a-z]\b/i;

/**
 * O carimbo como um modelo o leria do TEXTO — a imagem a simulação não vê.
 *
 * Sem nenhum campo legível, tudo volta nulo e sem erro: é o que um modelo de
 * verdade faz com um carimbo escaneado, e é o caso de V2 ("a leitura de selo
 * volta vazia"). Falhar aqui testaria outra coisa — a leitura que quebrou.
 */
function seloSimulado(texto: string) {
  const linhas = textoExtraidoDoSelo(texto).split("\n").map((l) => l.trim());
  const arquivo =
    valorDoRotulo(linhas, /^ARQUIVO\s*:?/i) ?? linhas.join(" ").match(CODIGO_DE_PRANCHA)?.[0] ?? null;
  const conteudo = valorDoRotulo(linhas, /^CONTE[ÚU]DO\s*:?/i);
  const prancha = valorDoRotulo(linhas, /^PRANCHA\s*:?/i);
  const numeracao = prancha ? /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(prancha) : null;
  const legivel = Boolean(arquivo || conteudo || numeracao);
  const disciplina = arquivo
    ? (/[_-]([a-z]{2,5})[_-]\d{2,3}[_-][a-z]$/i.exec(arquivo)?.[1]?.toUpperCase() ?? null)
    : null;
  return {
    disciplina,
    folha: numeracao ? Number(numeracao[1]) : null,
    total: numeracao ? Number(numeracao[2]) : null,
    numeroFolha: numeracao ? prancha : null,
    arquivo,
    conteudo,
    cliente: legivel ? valorDoRotulo(linhas, /^CLIENTE\s*:?/i) : null,
    secretaria: null,
    obra: legivel ? valorDoRotulo(linhas, /^OBRA\s*:?/i) : null,
    fase: null,
    tituloSecao: conteudo,
    data: null,
    logoOrgao: null,
    confianca: legivel ? "alta" : "baixa",
  };
}

/** Quantas imagens o pedido leva — as conferências respondem uma leitura por imagem. */
function imagensDoPedido(request: unknown): number {
  const input = (request as { input?: unknown } | null)?.input;
  if (!Array.isArray(input)) return 0;
  let n = 0;
  for (const item of input) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    n += content.filter((c) => (c as { type?: unknown })?.type === "input_image").length;
  }
  return n;
}

/**
 * As propostas do agente, pelo pedido. Campos SOLTOS, e não `params`: é o
 * formato do prompt real (server/nexo/agent/run-turn.ts) e o que
 * `normalizeProposals` lê. A auditoria continua no formato que já passava.
 */
function propostasDoPedido(pedido: string): Record<string, unknown>[] {
  if (/audit/i.test(pedido)) {
    return [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }];
  }
  const propostas: Record<string, unknown>[] = [];
  const titulo =
    /t[íi]tulo\s+(?:da\s+LD\s+)?(?:[ée]\s+|para\s+)?["“]?([^"”\n]+?)["”]?\s*$/i.exec(pedido)?.[1]?.trim() ?? "";
  if (/\bLD\b|lista de documentos/i.test(pedido)) {
    propostas.push({ kind: "ld", resumo: "LD", tituloLd: titulo, numTomos: 1, tomoInicial: 1 });
  }
  if (/\b(monta|montar|junta|juntar)\b[\s\S]*\bvolume\b/i.test(pedido)) {
    propostas.push({ kind: "volume", resumo: "Volume" });
  }
  return propostas;
}

function corpoDaOperacao(operation: string, request: unknown): string {
  const texto = textoDoPedido(request);

  switch (operation) {
    case "audit-global": {
      const trechos = trechosAncoraveis(texto);
      const escolhidos = [...new Set([0, Math.floor(trechos.length / 2), trechos.length - 1])]
        .filter((i) => i >= 0 && i < trechos.length)
        .map((i) => trechos[i]);
      return JSON.stringify({ findings: escolhidos.map((a, i) => achadoSimulado(i, a)), sintese: [] });
    }
    case "audit-validation":
      return JSON.stringify({ decisions: [] });
    case "audit-chunk":
    case "audit-coherence":
    case "audit-identity":
      return JSON.stringify({ findings: [] });
    case "audit-cross-document":
      return JSON.stringify({ comparisons: [], findings: [] });
    case "audit-refutation":
      return JSON.stringify({ verdicts: [] });
    case "audit-transcricao":
      return "TEXTO TRANSCRITO PELA IA SIMULADA.";
    case "audit-chat-turn":
      return "Resposta simulada do chat da auditoria.";
    case "nexo-agent-turn": {
      const propostas = propostasDoPedido(pedidoDoEngenheiro(texto));
      if (propostas.length > 0) {
        const reply =
          propostas[0].kind === "auditoria"
            ? "Vou auditar o memorial (resposta simulada)."
            : `Proposta pronta (resposta simulada): ${propostas.map((p) => p.kind).join(", ")}.`;
        const cauda = { reply, proposals: propostas };
        return `${reply}\n\n\`\`\`json\n${JSON.stringify(cauda)}\n\`\`\``;
      }
      return "Entendido (resposta simulada).";
    }
    case "nexo-selo":
    case "nexo-selo-image":
      return JSON.stringify(seloSimulado(texto));
    case "nexo-selo-identidade":
      return JSON.stringify({
        leituras: Array.from({ length: imagensDoPedido(request) }, () => ({
          endereco: null,
          orgao: null,
          logoPresente: false,
          logoOrgao: null,
          numeracaoTexto: null,
          folha: null,
          total: null,
        })),
      });
    case "nexo-volume-check":
      return JSON.stringify({
        leituras: Array.from({ length: imagensDoPedido(request) }, () => ({
          numeracaoTexto: null,
          folha: null,
          total: null,
          codigo: null,
          titulo: null,
          disciplina: null,
          orgao: null,
          obra: null,
        })),
      });
    default:
      throw new Error(`operação sem simulação: ${operation}`);
  }
}

function erroDeAborto() {
  const erro = new Error("Request was aborted.");
  erro.name = "AbortError";
  return erro;
}

function esperar(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(erroDeAborto());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(erroDeAborto());
      },
      { once: true },
    );
  });
}

export async function respostaSimulada(pedido: Pedido, signal?: AbortSignal): Promise<RespostaSimulada> {
  const comportamento = tirarDaFila(pedido.operation);

  if (comportamento === "abortar") throw erroDeAborto();
  if (comportamento === "503") {
    const erro = new Error("503 Our servers are currently overloaded. Please try again later.") as Error & {
      status?: number;
    };
    erro.status = 503;
    throw erro;
  }
  if (comportamento?.startsWith("lento:")) {
    await esperar(Number(comportamento.slice("lento:".length)), signal);
  }
  if (comportamento === "truncar") {
    return completa("", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
  }
  if (comportamento === "recusar") {
    return completa("", {
      output: [
        { type: "message", role: "assistant", content: [{ type: "refusal", refusal: "Não posso ajudar com isso." }] },
      ],
    });
  }
  if (comportamento === "json-invalido") {
    return completa("isto não é json {");
  }

  return completa(corpoDaOperacao(pedido.operation, pedido.request));
}

/** Os mesmos eventos que `executeOpenAiResponseStream` lê da OpenAI. */
export async function* streamSimulado(pedido: Pedido, signal?: AbortSignal) {
  const resposta = await respostaSimulada(pedido, signal);
  if (resposta.status === "incomplete") {
    yield { type: "response.incomplete", response: resposta };
    return;
  }
  for (let i = 0; i < resposta.output_text.length; i += 24) {
    yield { type: "response.output_text.delta", delta: resposta.output_text.slice(i, i + 24) };
  }
  yield { type: "response.completed", response: resposta };
}
