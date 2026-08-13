/**
 * Nexo Core — tipos e a máquina de estados VISUAL do agente. A esfera não conhece
 * IA/backend/API: recebe só props abstratas (`state`/`fileCount`/`activity`) e a
 * aplicação converte eventos reais nesses estados.
 */

/**
 * Os estados VISUAIS do agente.
 *
 * `hover` e `uploading` saíram daqui, e a saída conserta uma mentira do enum:
 * a máquina (`use-agent-state.ts`) nunca produziu nenhum dos dois.
 *
 * `hover` é reação FÍSICA — passar o mouse entra por `hovered` e é amortecido
 * no Scene, somado ao estado real. Tê-lo também como estado permitia aplicar o
 * realce em dobro, e a bancada o oferecia no seletor como se a aplicação
 * pudesse chegar lá.
 *
 * `uploading` nunca teve sinal próprio: enviar e ler acontecem no mesmo gesto,
 * e o que o usuário vê acontecer é a leitura. O `NexoCopilot` já tratava os
 * dois como um caso só em todo lugar que perguntava.
 */
export type AgentState =
  | "idle"
  | "dragging"
  | "reading"
  | "analyzing"
  | "auditing"
  | "responding"
  | "complete"
  | "waiting"
  | "error";

/**
 * A lista, na ordem de prioridade da máquina. É a FONTE ÚNICA: a bancada monta
 * o seletor a partir daqui, então estado novo aparece lá sem trabalho extra.
 * Antes era uma lista escrita à mão em `bancada.tsx` — e ela já divergia deste
 * arquivo, oferecendo dois estados que não existiam.
 */
export const AGENT_STATES: readonly AgentState[] = [
  "error",
  "dragging",
  "reading",
  "responding",
  "analyzing",
  "auditing",
  "complete",
  "waiting",
  "idle",
] as const;

export interface AgentOrbProps {
  /** Estado do agente (a app mapeia eventos reais → este enum). */
  state?: AgentState;
  /** Nº de documentos no contexto (satélites — Fase 3). */
  fileCount?: number;
  /** Atividade real 0..1 (streaming/análise — Fase 2). */
  activity?: number;
  /** Tamanho no layout: hero (home) ou compact (workspace). */
  size?: "hero" | "compact";
  /** Reage a hover/click (drop-target chega na Fase 3). */
  interactive?: boolean;
  /**
   * O cursor está no composer. O aro sobe um pouco — "estou ouvindo".
   *
   * É reação FÍSICA, como o hover, e por isso entra como prop em vez de virar
   * estado: o agente não muda o que está fazendo porque alguém pôs o cursor no
   * campo, e um estado diria que mudou.
   */
  ouvindo?: boolean;
  /** Abre o menu do agente (arquitetura pronta; conteúdo é da UI). */
  onActivate?: () => void;
  className?: string;
}

/**
 * Parâmetros VISUAIS que dirigem os uniforms/transform da esfera. São ALVOS por
 * estado; o loop faz damping do atual → alvo (nada de re-render por frame).
 */
export interface OrbVisualParams {
  /** Deslocamento procedural dos vértices (deformação). */
  distortion: number;
  /** Glow pulsante do núcleo. */
  pulse: number;
  /** Força do Fresnel (aro do vidro). */
  rim: number;
  /** Plano de leitura (scanner técnico) 0..1. */
  scan: number;
  /** Multiplicador de rotação lenta. */
  spin: number;
  /** Instabilidade (erro) 0..1. */
  jitter: number;
  /**
   * Ciclos por segundo do respiro do miolo. 1,5 é o repouso do produto (~4s de
   * ida e volta) e vale para quase tudo; `waiting` usa metade.
   *
   * Virou parâmetro quando a espera precisou de ritmo próprio: a diferença
   * entre "o agente está parado" e "o agente está esperando VOCÊ" não cabe em
   * brilho nem em cor — cabe em cadência, que é como o corpo lê espera.
   */
  breathRate: number;
}

/**
 * Alvos por estado. Coerente com engenharia/CAD: movimento lento, nada frenético.
 * `reading` usa `activity` como PROGRESSO da leitura (done/total); `responding`
 * usa como CADÊNCIA do texto que chega.
 */
export function paramsForState(
  state: AgentState,
  activity = 0,
): OrbVisualParams {
  const a = Math.max(0, Math.min(1, activity));
  switch (state) {
    case "dragging":
      return { distortion: 0.12, pulse: 0.4, rim: 0.95, scan: 0, spin: 0.26, jitter: 0, breathRate: 1.5 };
    case "reading":
      // `scan` acompanha o progresso real da leitura (0..1): o plano varre a
      // esfera conforme as pranchas são lidas, em vez de varrer sempre igual.
      return {
        distortion: 0.08,
        pulse: 0.32 + a * 0.18,
        rim: 0.72,
        scan: 0.35 + a * 0.65,
        spin: 0.2,
        jitter: 0,
        breathRate: 1.5,
      };
    case "analyzing":
      return { distortion: 0.17, pulse: 0.62, rim: 0.88, scan: 0.25, spin: 0.36, jitter: 0, breathRate: 1.5 };
    /*
     * AUDITAR não é PENSAR, e a diferença tem de estar na cara.
     *
     * A auditoria já movia o orbe: o workspace injetava o "auditando" no sinal
     * de `thinking` desde que alguém notou que a esfera dizia "pronto" durante
     * os seis minutos da análise. Só que ela o movia com o vocabulário do chat
     * — `analyzing`, que é a cara de um turno de segundos. Seis minutos naquele
     * ritmo não leem como trabalho longo; leem como travamento.
     *
     * Aqui a distorção é BAIXA e o giro é FIRME: a esfera não se agita, ela
     * percorre. Quem carrega a leitura é a varredura, que neste estado sobe
     * sempre na mesma direção (`uScanMode`) em vez de ir e vir.
     */
    case "auditing":
      return { distortion: 0.09, pulse: 0.4, rim: 0.78, scan: 1, spin: 0.3, jitter: 0, breathRate: 1.5 };
    case "responding":
      return {
        distortion: 0.1 + a * 0.1,
        pulse: 0.35 + a * 0.4,
        rim: 0.8,
        scan: 0,
        spin: 0.28 + a * 0.12,
        jitter: 0,
        breathRate: 1.5,
      };
    case "complete":
      return { distortion: 0.05, pulse: 0.7, rim: 0.92, scan: 0, spin: 0.16, jitter: 0, breathRate: 1.5 };
    case "error":
      return { distortion: 0.14, pulse: 0.3, rim: 0.62, scan: 0, spin: 0.1, jitter: 1, breathRate: 1.5 };
    /*
     * A BOLA ESTÁ COM VOCÊ.
     *
     * Metade dos turnos deste produto termina com o agente perguntando — é o
     * princípio 2 do produto: afirma fatos, pergunta decisões. E o orbe só
     * sabia falar do próprio trabalho: em repouso, "terminei e espero você" e
     * "não há nada acontecendo" tinham exatamente a mesma cara.
     *
     * O aro um pouco acima do idle é o que diz "ainda estou aqui"; o respiro
     * pela metade é o que diz "sem pressa". Nenhum dos dois é trabalho, e por
     * isso o rótulo do cartão não pulsa: esperar não é fazer.
     */
    case "waiting":
      return { distortion: 0.05, pulse: 0.22, rim: 0.62, scan: 0, spin: 0.12, jitter: 0, breathRate: 0.75 };
    case "idle":
    default:
      return { distortion: 0.06, pulse: 0.16, rim: 0.52, scan: 0, spin: 0.15, jitter: 0, breathRate: 1.5 };
  }
}
