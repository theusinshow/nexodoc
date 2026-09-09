"use client";

/**
 * FOCO — um temporizador, e a única coisa desta tela que não sabe nada do
 * NexoDoc.
 *
 * Ele está aqui porque a auditoria de um memorial é trabalho de bloco: são 40 a
 * 90 minutos lendo achado por achado, e a pessoa hoje sai do produto para
 * marcar esse tempo em outro lugar. Sair da ferramenta para se organizar em
 * volta dela é o custo que "Seu espaço" existe para tirar.
 *
 * O RELÓGIO NÃO É UM `setInterval` QUE CONTA. Ele guarda o INSTANTE do fim
 * (`fimEm`) e desenha a diferença; o intervalo só serve para pedir novo quadro.
 * A diferença importa: aba em segundo plano tem o `setInterval` estrangulado
 * pelo navegador — a 1 tique por segundo vira 1 por minuto —, e um contador que
 * decrementa perderia minutos calados. É o mesmo defeito de aba inativa que já
 * pegou o render de pranchas neste produto.
 *
 * SEM SOM E SEM NOTIFICAÇÃO. Som exige gesto de permissão e toca em reunião;
 * `Notification` exige um portão de permissão do navegador para um widget
 * opcional. O fim é visual, e insiste até alguém desligar.
 */

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Casco } from "./casco";

const MINUTOS = [25, 45, 60] as const;

export function WidgetFoco() {
  const [escolhido, setEscolhido] = React.useState<number>(45);
  /** Instante do fim, em ms. Nulo quando parado. */
  const [fimEm, setFimEm] = React.useState<number | null>(null);
  /** O que sobra quando se pausa. Vira o novo total ao voltar a correr. */
  const [restante, setRestante] = React.useState<number>(45 * 60_000);
  const [agora, setAgora] = React.useState<number>(() => Date.now());

  const correndo = fimEm !== null;
  const faltam = correndo ? Math.max(0, fimEm - agora) : restante;
  const acabou = correndo && faltam === 0;

  React.useEffect(() => {
    if (!correndo) return;

    /*
     * 500ms e não 1000: com um tique por segundo, o segundo desenhado pula de
     * dois em dois quando o relógio da máquina e o do intervalo saem de fase, e
     * o mostrador parece travar. Amostrar mais rápido que a unidade exibida é o
     * conserto barato — nada é recalculado, só o `Date.now()`.
     */
    const id = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [correndo]);

  function comecar(ms = restante) {
    setRestante(ms);
    setFimEm(Date.now() + ms);
    setAgora(Date.now());
  }

  function pausar() {
    setRestante(faltam);
    setFimEm(null);
  }

  function zerar(minutos = escolhido) {
    setFimEm(null);
    setEscolhido(minutos);
    setRestante(minutos * 60_000);
  }

  const total = escolhido * 60_000;
  // Fração PERCORRIDA, para o anel crescer em vez de encolher: um arco que
  // some conforme o tempo passa lê como bateria acabando, e não como progresso.
  const fracao = total > 0 ? Math.min(1, Math.max(0, 1 - faltam / total)) : 0;

  return (
    <Casco
      titulo="Foco"
      acessorio={
        <div className="flex items-center gap-1">
          {MINUTOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => zerar(m)}
              aria-pressed={escolhido === m}
              className={cn(
                "nx-cut-4 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums transition-colors duration-[var(--duration-fast)]",
                escolhido === m
                  ? "bg-[var(--secondary)] text-[var(--nexodoc-accent)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <Mostrador ms={faltam} fracao={fracao} acabou={acabou} />

        <div className="flex flex-1 flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => (correndo ? pausar() : comecar(acabou ? total : restante))}
            className="nx-cut-5 inline-flex items-center gap-2 bg-[#0f2d2a] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--nexodoc-accent)] transition-colors duration-[var(--duration-fast)] hover:bg-[#164039]"
          >
            {correndo ? (
              <Pause className="h-3 w-3" strokeWidth={1.8} aria-hidden />
            ) : (
              <Play className="h-3 w-3" strokeWidth={1.8} aria-hidden />
            )}
            {correndo ? "Pausar" : acabou ? "De novo" : "Iniciar"}
          </button>

          <button
            type="button"
            onClick={() => zerar()}
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.6} aria-hidden />
            Zerar
          </button>
        </div>
      </div>
    </Casco>
  );
}

/**
 * O MOSTRADOR — número grande, anel fino.
 *
 * O anel é `stroke-dasharray` num círculo SVG, e não uma barra: numa caixa de
 * 200px de largura, uma barra de progresso é uma linha de 4px que não se lê de
 * relance, e o anel devolve a leitura em volta do número que a pessoa já está
 * olhando.
 *
 * `--primary` E NÃO STATUS. Contar tempo não é um estado do trabalho — não é
 * "ok", não é "atenção". Teal é a cor de "isto responde a você", que é
 * exatamente o que um cronômetro que você mesmo iniciou é. No fim ele vira
 * âmbar, e AÍ sim é status: o bloco acabou e algo mudou.
 */
function Mostrador({ ms, fracao, acabou }: { ms: number; fracao: number; acabou: boolean }) {
  const total = Math.round(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");

  const R = 26;
  const volta = 2 * Math.PI * R;
  const cor = acabou ? "var(--status-warning)" : "var(--primary)";

  return (
    <div className="relative grid h-[64px] w-[64px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--nexodoc-raised)" strokeWidth="3" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={cor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - fracao)}
          style={{ transition: "stroke-dashoffset var(--duration-fast) linear" }}
        />
      </svg>

      <span
        className="relative font-mono text-[15px] font-medium tabular-nums tracking-[-0.02em]"
        style={{ color: acabou ? "var(--status-warning)" : "var(--foreground)" }}
      >
        {mm}:{ss}
      </span>

      {/* O texto do fim, para quem lê por leitor de tela: o anel é `aria-hidden`
          e a mudança de cor não é anunciada por ninguém. */}
      {acabou ? <span className="sr-only">Tempo encerrado</span> : null}
    </div>
  );
}
