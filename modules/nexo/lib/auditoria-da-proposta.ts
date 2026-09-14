/**
 * AUDITORIA DA PROPOSTA: cada rodada com o próprio resultado.
 *
 * O resultado da auditoria tinha id fixo por DOCUMENTO (`auditoria:117-25`).
 * Enquanto cada memorial era auditado uma vez só, tanto fazia. Em 14/09/2026 o
 * 117_25 foi auditado de novo na mesma conversa e tudo que dependia do id se
 * confundiu:
 * - o cartão novo achava o parecer antigo e escondia o formulário;
 * - a detecção das folhas mudas e a comparação com a rodada anterior ficavam
 *   desligadas, porque "já havia resultado";
 * - o parecer novo sobrescrevia o anterior, e o palco nunca tinha duas rodadas
 *   para comparar;
 * - a reconexão depois de F5 via o parecer velho e jogava fora o bilhete da
 *   rodada nova.
 *
 * Agora o id é da PROPOSTA (a mensagem que trouxe o cartão). Rodar de novo é
 * outra proposta, com outro cartão e outro resultado, e a história fica.
 *
 * Módulo puro: sem React, testado em node cru.
 */

export function idDaAuditoriaDaProposta(codigo: string | null | undefined, mensagemId: string) {
  return `auditoria:${codigo?.trim() || "x"}:${mensagemId}`;
}

/** `auditoria:<código>`, sem a proposta: o formato de antes de 14/09/2026. */
const LEGADO = /^auditoria:([^:]+)$/;

type Mensagem = { id: string; proposals?: readonly { kind: string }[] };
type Resultado = { artifactId: string; kind: string; generatedAt?: number; payload?: unknown };
type Registro = { auditId: string; artifactId: string };

function auditIdDoPayload(payload: unknown) {
  const id = (payload as { auditId?: unknown } | null | undefined)?.auditId;
  return typeof id === "string" ? id : undefined;
}

/**
 * Leva os resultados do formato antigo para o id por proposta.
 *
 * Roda ao abrir a conversa, e por isso ANTES de qualquer proposta nova existir:
 * a última proposta de auditoria de uma conversa antiga é, de fato, a que
 * produziu o parecer que ficou gravado. Com mais de um documento, o casamento é
 * de trás para frente: o parecer mais recente fica com a proposta mais recente.
 *
 * O que não se deixa casar fica como está, e não quebra nada: o palco segue
 * mostrando o parecer, só o cartão antigo não o reencontra.
 */
export function migrarAuditoriasLegadas<
  R extends Resultado,
  P extends Registro,
>(rec: {
  messages: readonly Mensagem[];
  results: readonly R[];
  auditorias?: readonly Registro[];
  auditoriaPendente?: P | null;
  artefatosApagados?: readonly string[];
}): {
  results: R[];
  auditorias?: Registro[];
  auditoriaPendente?: P | null;
  artefatosApagados?: string[];
  migrou: boolean;
} {
  const semMudanca = {
    results: [...rec.results],
    ...(rec.artefatosApagados ? { artefatosApagados: [...rec.artefatosApagados] } : {}),
    ...(rec.auditorias ? { auditorias: [...rec.auditorias] } : {}),
    ...(rec.auditoriaPendente !== undefined ? { auditoriaPendente: rec.auditoriaPendente } : {}),
    migrou: false,
  };

  const donosAtuais = new Set(
    rec.results
      .map((r) => r.artifactId.split(":")[2])
      .filter((x): x is string => Boolean(x)),
  );
  const propostas = rec.messages
    .filter((m) => m.proposals?.some((p) => p.kind === "auditoria"))
    .map((m) => m.id)
    .filter((id) => !donosAtuais.has(id));
  if (propostas.length === 0) return semMudanca;

  // Parecer aberto por link usa o próprio auditId como sufixo: não é legado.
  const legados = rec.results
    .filter((r) => {
      if (r.kind !== "auditoria") return false;
      const m = LEGADO.exec(r.artifactId);
      return Boolean(m) && m![1] !== auditIdDoPayload(r.payload);
    })
    .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0));

  const codigosSoNoRegistro = [
    ...(rec.auditorias ?? []).map((a) => a.artifactId),
    ...(rec.auditoriaPendente ? [rec.auditoriaPendente.artifactId] : []),
  ].filter(
    (id) => LEGADO.test(id) && !legados.some((r) => r.artifactId === id),
  );
  if (legados.length === 0 && codigosSoNoRegistro.length === 0) return semMudanca;

  /** id antigo → índice (em `propostas`) da proposta dona. */
  const dono = new Map<string, number>();
  let proxima = propostas.length - 1;
  for (let i = legados.length - 1; i >= 0 && proxima >= 0; i--) {
    dono.set(legados[i].artifactId, proxima);
    proxima--;
  }
  // Rodada em voo sem parecer ainda: é da última proposta livre.
  for (const id of codigosSoNoRegistro) {
    if (!dono.has(id)) dono.set(id, propostas.length - 1);
  }

  const novoId = (antigo: string, indice: number) =>
    idDaAuditoriaDaProposta(LEGADO.exec(antigo)![1], propostas[Math.max(0, indice)]);

  const results = rec.results.map((r) => {
    const i = dono.get(r.artifactId);
    return i === undefined || !legados.includes(r) ? r : { ...r, artifactId: novoId(r.artifactId, i) };
  });

  /*
   * O REGISTRO das rodadas. A que produziu o parecer fica com a proposta dele.
   * As ANTERIORES do mesmo documento (sobrescritas no formato antigo) descem uma
   * proposta cada — é assim que a rodada perdida volta a ter um cartão, e que a
   * recuperação pelo servidor passa a enxergar que falta o parecer dela. As
   * POSTERIORES (em voo) ficam com a proposta do parecer.
   */
  let auditorias: Registro[] | undefined;
  if (rec.auditorias) {
    const donoDoParecer = new Map(
      legados.map((r) => [r.artifactId, auditIdDoPayload(r.payload)] as const),
    );
    auditorias = rec.auditorias.map((a) => ({ ...a }));
    for (const [antigo, indice] of dono) {
      const doCodigo = auditorias.filter((a) => a.artifactId === antigo);
      const doParecer = donoDoParecer.get(antigo);
      const k = doCodigo.findIndex((a) => a.auditId === doParecer);
      doCodigo.forEach((a, j) => {
        const recuo = k === -1 ? doCodigo.length - 1 - j : Math.max(0, k - j);
        a.artifactId = novoId(antigo, indice - recuo);
      });
    }
  }

  let auditoriaPendente = rec.auditoriaPendente;
  if (auditoriaPendente && dono.has(auditoriaPendente.artifactId)) {
    const casado = auditorias?.find((a) => a.auditId === auditoriaPendente!.auditId);
    auditoriaPendente = {
      ...auditoriaPendente,
      artifactId:
        casado?.artifactId ??
        novoId(auditoriaPendente.artifactId, dono.get(auditoriaPendente.artifactId)!),
    };
  }

  /*
   * O que foi APAGADO de propósito continua apagado com o id novo. Sem isto, a
   * recuperação pelo servidor veria um artefato faltando e traria de volta o
   * parecer que a pessoa mandou sumir.
   */
  let artefatosApagados = rec.artefatosApagados ? [...rec.artefatosApagados] : undefined;
  if (artefatosApagados && rec.auditorias && auditorias) {
    rec.auditorias.forEach((antes, i) => {
      const depois = auditorias![i].artifactId;
      if (depois !== antes.artifactId && artefatosApagados!.includes(antes.artifactId)) {
        if (!artefatosApagados!.includes(depois)) artefatosApagados!.push(depois);
      }
    });
  }

  return {
    results,
    ...(artefatosApagados ? { artefatosApagados } : {}),
    ...(auditorias ? { auditorias } : {}),
    ...(rec.auditoriaPendente !== undefined ? { auditoriaPendente } : {}),
    migrou: true,
  };
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O engenheiro pediu uma NOVA auditoria, e não fez uma pergunta sobre o parecer.
 *
 * Com parecer no palco, toda mensagem ia ao chat da auditoria, e ele só
 * repassava ao Nexo se o modelo decidisse chamar a ferramenta. Em 14/09/2026 o
 * "audita o memorial" rendeu "Encaminhei a nova auditoria" duas vezes sem
 * cartão nenhum. Pedido de ação é regra, e não palpite do modelo.
 *
 * Só a forma de pedido: verbo no começo, ou as locuções de repetir. Uma
 * pergunta que MENCIONA auditoria ("por que a auditoria deu 10?") segue para o
 * chat, que é quem tem o parecer.
 */
export function pedeNovaAuditoria(texto: string) {
  const t = normalizar(texto);
  if (t.endsWith("?")) return false;
  if (/^(por favor,? )?(re)?audit(a|ar|e|em)\b/.test(t)) return true;
  if (/^transcrever e auditar\b/.test(t)) return true;
  if (/\b(quero|pode|vamos|precis[oa]) (re)?auditar\b/.test(t)) return true;
  if (/\b(auditar|audita|audite) (de novo|novamente|outra vez)\b/.test(t)) return true;
  if (/\b(nova auditoria|reauditar|reauditoria)\b/.test(t)) return true;
  if (/\b(roda|rode|rodar|refaz|refaca|refazer|faz|faca|fazer) (a |uma )?(nova )?auditoria\b/.test(t)) {
    return true;
  }
  return false;
}
