/**
 * QUANTAS AUDITORIAS RODAM AO MESMO TEMPO — a parede que protege a memória.
 *
 * O teto de gasto (`ai-budget.ts`) protege a FATURA e não protege a MÁQUINA:
 * ele mede dólares já registrados, e dez auditorias simultâneas custam pouco
 * enquanto rodam e derrubam o container muito antes de virarem dinheiro.
 *
 * O que derruba é memória. Cada auditoria segura, do início ao fim de uma
 * conexão SSE, um PDF de até 25 MB mais o que o pdfjs constrói em cima dele,
 * e dispara `NEXODOC_CHUNK_CONCURRENCY` blocos em paralelo. O modo de falha é
 * o pior possível: o OOM não recusa a auditoria que passou do ponto, ele mata
 * o processo — e com ele TODAS as conexões abertas, inclusive as de quem não
 * pediu nada de grande.
 *
 * Recusar a décima auditoria com uma mensagem clara é melhor que aceitar as
 * dez e perder as nove.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * DESLIGADO POR PADRÃO, e isso é deliberado. Sem as variáveis, este módulo
 * deixa passar tudo, exatamente como antes de existir. Um número inventado
 * aqui recusaria trabalho legítimo no primeiro dia movimentado, e quantas
 * auditorias a máquina aguenta depende do plano contratado — algo que o código
 * não tem como saber.
 *
 * - `NEXODOC_MAX_AUDITORIAS_SIMULTANEAS` — por usuário. Contra o indivíduo que
 *   dispara cinco de uma vez. Um valor humano é 2: ninguém acompanha três
 *   auditorias ao mesmo tempo de verdade.
 * - `NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL` — do processo inteiro. É ESTE
 *   que protege a RAM, e é o que importa dimensionar junto com o plano.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A CONTA VIVE NO PROCESSO, não no banco, e isso tem um limite conhecido: com
 * mais de uma instância, cada uma conta a sua. O limite por usuário passa a
 * valer por instância (alguém com duas abas em instâncias diferentes escapa),
 * e o global vira "por instância" — que, para proteger memória, é justamente
 * a régua certa, já que a memória também é por instância.
 *
 * Trocar isso por contagem no banco custaria uma escrita e uma leitura no
 * caminho quente de toda auditoria, para resolver um problema que só aparece
 * com escala horizontal ligada. Quando ela existir, este é o lugar de mudar.
 *
 * `globalThis` pelo mesmo motivo de `lib/db.ts`: o recarregamento de módulo do
 * Next em desenvolvimento zeraria um contador de escopo de módulo, e a conta
 * passaria a mentir depois da primeira edição de arquivo.
 */
import { numeroDoControle } from "@/lib/cache-de-controles";


const globalParaVazao = globalThis as unknown as {
  nexodocAuditoriasEmCurso?: Map<string, number>;
  nexodocAuditoriasGlobais?: { total: number };
};

function getContagemPorUsuario(): Map<string, number> {
  globalParaVazao.nexodocAuditoriasEmCurso ??= new Map();
  return globalParaVazao.nexodocAuditoriasEmCurso;
}

function getContagemGlobal(): { total: number } {
  globalParaVazao.nexodocAuditoriasGlobais ??= { total: 0 };
  return globalParaVazao.nexodocAuditoriasGlobais;
}

/*
 * O PAINEL VENCE A VARIÁVEL, pela escada de [[cache-de-controles.ts]]. A
 * leitura continua síncrona e sem banco: o cache é memória do processo, e sem
 * ele a escada cai no ambiente — que é como isto funcionava antes do painel.
 *
 * `Math.floor` sobrevive à mudança: meia auditoria simultânea não existe, e a
 * guarda do painel aceita decimal como qualquer campo numérico.
 */
function lerLimite(chave: "vazao.usuario" | "vazao.global"): number | null {
  const valor = numeroDoControle(chave);
  return valor !== null && valor > 0 ? Math.floor(valor) : null;
}

export function getLimitePorUsuario(): number | null {
  return lerLimite("vazao.usuario");
}

export function getLimiteGlobal(): number | null {
  return lerLimite("vazao.global");
}

export interface VagaRecusada {
  ok: false;
  /** Qual parede recusou — muda o que o usuário lê e o que quem opera faz. */
  escopo: "usuario" | "global";
  /** Quantas já estavam em curso quando a vaga foi pedida. */
  emCurso: number;
  /** O limite que foi batido. */
  limite: number;
}

export interface VagaConcedida {
  ok: true;
  /**
   * DEVOLVE A VAGA. Idempotente de propósito: o caminho de erro de uma rota
   * SSE tem mais de uma saída (falha na entrada, aborto do cliente, fim do
   * stream), e a alternativa a poder chamar duas vezes seria cada chamador
   * rastrear se já liberou — que é exatamente o tipo de contabilidade que
   * vaza vaga quando alguém esquece um `finally`.
   */
  liberar: () => void;
}

export type Vaga = VagaConcedida | VagaRecusada;

/**
 * Pede uma vaga para rodar uma auditoria.
 *
 * O global é checado ANTES do individual: quando a máquina está cheia, saber
 * que este usuário ainda tinha direito a mais uma não muda a decisão, e a
 * mensagem que ele precisa ler é a de "o sistema está ocupado" — não a de "você
 * abusou". Recusar pela razão errada manda a pessoa tentar de novo daqui a
 * pouco quando devia mandá-la fechar a outra aba, ou o contrário.
 *
 * `chave` é quem pediu (id ou e-mail). Sem chave, a auditoria conta só para o
 * limite global: sem dono, não há o que somar por usuário — e deixar de contar
 * no global seria abrir uma porta que não fecha.
 */
export function pedirVaga(chave: string | null | undefined): Vaga {
  const limiteGlobal = getLimiteGlobal();
  const limiteUsuario = getLimitePorUsuario();
  const global = getContagemGlobal();
  const porUsuario = getContagemPorUsuario();
  const dono = (chave ?? "").trim().toLowerCase();

  if (limiteGlobal !== null && global.total >= limiteGlobal) {
    return { ok: false, escopo: "global", emCurso: global.total, limite: limiteGlobal };
  }

  const doUsuario = dono ? (porUsuario.get(dono) ?? 0) : 0;
  if (dono && limiteUsuario !== null && doUsuario >= limiteUsuario) {
    return { ok: false, escopo: "usuario", emCurso: doUsuario, limite: limiteUsuario };
  }

  global.total += 1;
  if (dono) {
    porUsuario.set(dono, doUsuario + 1);
  }

  let liberada = false;
  return {
    ok: true,
    liberar: () => {
      if (liberada) return;
      liberada = true;

      global.total = Math.max(0, global.total - 1);

      if (!dono) return;
      const restante = (porUsuario.get(dono) ?? 1) - 1;
      /*
       * A chave SAI do mapa ao zerar. Deixá-la com 0 faria o mapa crescer com
       * o número de usuários que já auditaram alguma vez — um vazamento lento
       * num processo que fica meses no ar.
       */
      if (restante <= 0) {
        porUsuario.delete(dono);
      } else {
        porUsuario.set(dono, restante);
      }
    },
  };
}

/** A mensagem que quem foi recusado lê — diz a causa e o que fazer. */
export function mensagemDeVagaRecusada(vaga: VagaRecusada): string {
  if (vaga.escopo === "global") {
    return `O sistema está processando o máximo de auditorias ao mesmo tempo (${vaga.limite}). Tente de novo em alguns minutos — nenhuma auditoria em andamento foi perdida.`;
  }

  return `Você já tem ${vaga.emCurso} ${vaga.emCurso === 1 ? "auditoria" : "auditorias"} em andamento, e o limite por usuário é ${vaga.limite}. Aguarde uma terminar para começar outra.`;
}

/** Quantas auditorias estão em curso agora — para diagnóstico e telas de admin. */
export function auditoriasEmCurso(): { global: number; porUsuario: Record<string, number> } {
  return {
    global: getContagemGlobal().total,
    porUsuario: Object.fromEntries(getContagemPorUsuario()),
  };
}
