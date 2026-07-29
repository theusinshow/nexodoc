"use client";

/**
 * O que a auditoria está fazendo, enquanto faz.
 *
 * As etapas são as REAIS do motor (`app/api/audit/route.ts`), na ordem em que
 * acontecem — nada de animação inventada para parecer trabalho. O componente
 * antigo (`components/audit-progress.tsx`) dizia "Analisando blocos em paralelo"
 * no nível Profundo, onde os blocos da frente foram CORTADOS: descrevia trabalho
 * que não acontece, e com tempos de outra época (30s, quando a leitura global
 * sozinha leva 180-210s).
 *
 * HONESTIDADE: o cliente não recebe progresso do servidor — `/api/audit` é um
 * POST único que só responde no fim. Então a etapa atual é ESTIMADA pelo tempo
 * decorrido, e o componente diz isso em vez de fingir precisão. Quando passa do
 * previsto, ele avisa que está demorando mais que o normal em vez de deixar a
 * última etapa piscando para sempre.
 */

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Uma etapa real do motor, com a duração típica medida no memorial de 132 páginas. */
interface Etapa {
  chave: string;
  rotulo: string;
  /** O que ela faz, em uma linha — some no modo compacto. */
  detalhe: string;
  /** Segundos típicos. Medidos em 2026-07-28 no 017-26 (Profundo). */
  segundos: number;
}

/*
 * A ordem é a de `deepAnalyzeFile`: extração → regras determinísticas (guardas,
 * identidade intra-documento, coerência) → leitura global por IA → cerca de
 * evidência → validação → consolidação.
 */
const ETAPAS_PROFUNDO: Etapa[] = [
  {
    chave: "extracao",
    rotulo: "Lendo o documento",
    detalhe: "Extrai o texto de todas as páginas do PDF.",
    segundos: 12,
  },
  {
    chave: "regras",
    rotulo: "Conferindo identidade e coerência",
    detalhe: "Regras determinísticas, sem IA: obra divergente, contradição entre capítulos.",
    segundos: 4,
  },
  {
    chave: "global",
    rotulo: "Lendo o projeto inteiro",
    detalhe: "Uma leitura da IA com o documento completo — é a etapa mais longa.",
    segundos: 200,
  },
  {
    chave: "evidencia",
    rotulo: "Conferindo as evidências no texto",
    detalhe: "Descarta achado que não se ancora em trecho real do documento.",
    segundos: 3,
  },
  {
    chave: "validacao",
    rotulo: "Separando o sólido do sugerido",
    detalhe: "Segunda passada: rebaixa o incerto em vez de apagá-lo.",
    segundos: 130,
  },
  {
    chave: "parecer",
    rotulo: "Consolidando o parecer",
    detalhe: "Ordena por impacto e fecha o veredito de emissão.",
    segundos: 5,
  },
];

/** No Padrão a IA lê uma amostra e os blocos por capítulo rodam. */
const ETAPAS_PADRAO: Etapa[] = [
  ETAPAS_PROFUNDO[0],
  ETAPAS_PROFUNDO[1],
  {
    chave: "global",
    rotulo: "Lendo o projeto",
    detalhe: "Leitura da IA sobre a parte do documento que cabe na janela.",
    segundos: 35,
  },
  {
    chave: "blocos",
    rotulo: "Lendo capítulo a capítulo",
    detalhe: "Blocos em paralelo, para alcançar o que a leitura única não cobriu.",
    segundos: 25,
  },
  ETAPAS_PROFUNDO[3],
  ETAPAS_PROFUNDO[4],
  ETAPAS_PROFUNDO[5],
];

function segundosDe(ms: number) {
  return Math.max(0, Math.floor(ms / 1000));
}

function formatarTempo(ms: number) {
  const s = segundosDe(ms);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

export function AuditoriaEmCurso({
  nivel,
  arquivo,
  inicioMs,
  onCancelar,
}: {
  nivel: "standard" | "deep";
  /** Nome do documento em análise. */
  arquivo: string;
  /** `Date.now()` de quando começou. */
  inicioMs: number;
  onCancelar?: () => void;
}) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const etapas = nivel === "deep" ? ETAPAS_PROFUNDO : ETAPAS_PADRAO;
  const decorrido = agora - inicioMs;
  const total = etapas.reduce((s, e) => s + e.segundos, 0);
  const passou = segundosDe(decorrido) > total;

  // Qual etapa o tempo decorrido alcança. É ESTIMATIVA — o componente diz isso.
  let acumulado = 0;
  let indiceAtual = etapas.length - 1;
  for (let i = 0; i < etapas.length; i++) {
    acumulado += etapas[i].segundos;
    if (segundosDe(decorrido) < acumulado) {
      indiceAtual = i;
      break;
    }
  }

  return (
    <section
      className="w-full max-w-[560px] overflow-hidden rounded-md border border-border bg-card"
      aria-live="polite"
      aria-busy="true"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
            Auditoria {nivel === "deep" ? "profunda" : "padrão"} em curso
          </p>
          <p className="mt-0.5 truncate text-sm text-foreground" title={arquivo}>
            {arquivo}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-border bg-[var(--nexodoc-recessed)] px-2 py-1 font-mono text-xs tabular-nums text-muted-foreground">
            {formatarTempo(decorrido)}
          </span>
          {onCancelar && (
            <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
              <X />
              Cancelar
            </Button>
          )}
        </div>
      </header>

      <ol className="divide-y divide-border/60">
        {etapas.map((etapa, i) => {
          const feita = i < indiceAtual;
          const atual = i === indiceAtual && !passou;
          return (
            <li
              key={etapa.chave}
              className={cn(
                "flex gap-3 px-4 py-2.5 transition-colors duration-150",
                atual && "bg-[var(--nexodoc-raised)]",
              )}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {feita ? (
                  <Check className="size-3.5 text-[var(--status-ok)]" aria-hidden />
                ) : atual ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[13px] leading-5",
                    atual ? "font-medium text-foreground" : feita ? "text-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {etapa.rotulo}
                </p>
                {atual && (
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {etapa.detalhe}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-border px-4 py-2.5">
        {passou ? (
          /*
           * Passou do previsto: dizer isso é mais útil (e mais honesto) do que
           * deixar a última etapa piscando como se ainda fosse rápido. A análise
           * segue rodando no servidor — o usuário decide se espera.
           */
          <p className="text-[11px] leading-4 text-[var(--status-warning)]">
            Está levando mais que o normal. A análise continua rodando no servidor.
          </p>
        ) : (
          <p className="text-[11px] leading-4 text-muted-foreground">
            As etapas seguem a ordem real da análise. O tempo de cada uma varia com
            o tamanho do documento.
          </p>
        )}
      </footer>
    </section>
  );
}
