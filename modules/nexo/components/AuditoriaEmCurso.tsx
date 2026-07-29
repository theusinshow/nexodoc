"use client";

/**
 * O que a auditoria está fazendo, enquanto faz.
 *
 * Agora os marcos vêm do MOTOR (`/api/audit` em modo de fluxo), não de um
 * cronômetro. Antes a etapa atual era estimada pelo tempo decorrido — e
 * estimativa envelhece mal: em documento grande a barra passava do previsto e a
 * interface não sabia dizer se estava perto do fim ou parada.
 *
 * O que continua honesto por construção: as duas etapas longas (leitura do
 * documento e validação) são UMA ida ao modelo, sem sinal interno. Delas o motor
 * manda início, fim e o TETO de tempo — nunca porcentagem. Estourado o teto, o
 * rodapé diz que passou do previsto, e o veredito ANÁLISE PARCIAL no fim
 * confirma o que a interface já tinha preparado, em vez de contradizer um
 * "quase pronto".
 *
 * As etapas listadas são as que aquele nível REALMENTE roda: no Profundo os
 * blocos por capítulo não aparecem, porque lá eles são cortados e o documento é
 * lido inteiro.
 */

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NOME_DA_PASSADA, type PassadaDaAuditoria } from "@/lib/audit-progress";
import { etapasDosMarcos, type MarcoRecebido } from "../lib/etapas-da-auditoria";
import { cn } from "@/lib/utils";

/** O que cada passada faz, em uma linha. Só aparece na etapa em curso. */
const DETALHE: Record<PassadaDaAuditoria, string> = {
  extracao: "Extrai o texto de todas as páginas do PDF.",
  regras: "Regras determinísticas, sem IA: obra divergente, contradição entre capítulos.",
  global: "Uma leitura da IA sobre o documento — é a etapa mais longa.",
  blocos: "Blocos por capítulo, para alcançar o que a leitura única não cobriu.",
  evidencia: "Descarta achado que não se ancora em trecho real do documento.",
  confronto: "Compara os documentos entre si — divergência de identidade entre arquivos.",
  validacao: "Segunda passada: rebaixa o incerto em vez de apagá-lo.",
  parecer: "Ordena por impacto e fecha o veredito de emissão.",
};

function formatarTempo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

export function AuditoriaEmCurso({
  nivel,
  arquivo,
  inicioMs,
  marcos,
  onCancelar,
  retomada = false,
}: {
  nivel: "standard" | "deep";
  /** Nome do documento em análise. */
  arquivo: string;
  /** `Date.now()` de quando começou. */
  inicioMs: number;
  /** Os marcos relatados pelo motor, na ordem em que chegaram. */
  marcos: MarcoRecebido[];
  onCancelar?: () => void;
  /**
   * Auditoria herdada de outra sessão (F5, troca de conversa). Não há marcos:
   * o fluxo de eventos morreu com a conexão anterior. Dizer isso é melhor do
   * que reencenar as etapas por tempo, que é justamente o que esta tela
   * deixou de fazer.
   */
  retomada?: boolean;
}) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const decorrido = agora - inicioMs;
  const etapas = etapasDosMarcos(marcos);
  const emCurso = etapas.find((e) => !e.concluida);

  /*
   * "Passou do previsto" só se afirma sobre uma etapa que declarou orçamento —
   * e medindo o tempo DELA, não o da auditoria inteira. Somar tudo faria a tela
   * acusar atraso em documento grande onde nada está atrasado.
   */
  const estourou =
    emCurso?.orcamentoMs !== undefined && agora - emCurso.inicioMs > emCurso.orcamentoMs;

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

      {etapas.length === 0 ? (
        // Antes do primeiro marco não há o que afirmar sobre o trabalho.
        <p className="px-4 py-4 text-[13px] text-muted-foreground">
          {retomada
            ? "Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar."
            : "Enviando o documento para análise…"}
        </p>
      ) : (
        <ol className="divide-y divide-border/60">
          {etapas.map((etapa) => {
            const atual = etapa === emCurso;
            const contagem =
              etapa.total !== undefined && etapa.indice !== undefined && !etapa.concluida
                ? ` — ${etapa.indice} de ${etapa.total}`
                : "";
            return (
              <li
                key={etapa.passada}
                className={cn(
                  "flex gap-3 px-4 py-2.5 transition-colors duration-150",
                  atual && "bg-[var(--nexodoc-raised)]",
                )}
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {etapa.concluida ? (
                    <Check className="size-3.5 text-[var(--status-ok)]" aria-hidden />
                  ) : (
                    <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[13px] leading-5",
                      atual
                        ? "font-medium text-foreground"
                        : "text-foreground/70",
                    )}
                  >
                    {NOME_DA_PASSADA[etapa.passada]}
                    {contagem}
                  </p>
                  {/*
                    O detalhe é o FATO que o motor mediu ("132 páginas, 314848
                    caracteres", "3 descartados por falta de evidência"). Só
                    quando ele não existe é que cabe a frase genérica.
                  */}
                  {(atual || etapa.detalhe) && (
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {etapa.detalhe ?? DETALHE[etapa.passada]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="border-t border-border px-4 py-2.5">
        {estourou ? (
          <p className="text-[11px] leading-4 text-[var(--status-warning)]">
            Esta etapa passou do tempo previsto; pode voltar incompleta. A análise
            continua rodando no servidor.
          </p>
        ) : retomada ? (
          <p className="text-[11px] leading-4 text-muted-foreground">
            Reconectada a uma análise já em curso — sem as etapas, que se perderam
            com a conexão anterior.
          </p>
        ) : (
          <p className="text-[11px] leading-4 text-muted-foreground">
            As etapas são relatadas pelo motor conforme acontecem.
          </p>
        )}
      </footer>
    </section>
  );
}
