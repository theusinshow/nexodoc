import type { ReactNode } from "react";

import {
  incompletudeDoParecer,
  type ParecerParaIncompletude,
} from "@/lib/auditoria-incompleta";
import { cn } from "@/lib/utils";

/**
 * O AVISO de auditoria incompleta, igual em toda tela que mostra o parecer.
 *
 * Existe porque o veredito sozinho não bastou: em 14/09/2026 o 117_25 saiu com
 * 10 achados só de regra (a leitura da IA abortou) e a contagem foi lida como o
 * total de problemas do documento. O aviso fica ACIMA do número, em vermelho
 * quando a IA não leu, e diz com todas as letras que o número não é o total.
 *
 * Não renderiza nada quando o parecer está completo.
 */
export function AvisoDeAuditoriaIncompleta({
  report,
  compacto = false,
  className,
  children,
}: {
  report: ParecerParaIncompletude | null | undefined;
  /** Para cartão estreito: título e frase, sem a lista de etapas. */
  compacto?: boolean;
  className?: string;
  /** Ação ao lado do aviso, como "Rodar de novo". */
  children?: ReactNode;
}) {
  if (!report) return null;
  const aviso = incompletudeDoParecer(report);
  if (!aviso.incompleta) return null;

  const cor = aviso.iaNaoLeu ? "critical" : "warning";

  return (
    <div
      role="alert"
      data-auditoria-incompleta={aviso.iaNaoLeu ? "sem-ia" : "parcial"}
      className={cn(
        "nx-cut-6",
        compacto ? "px-3 py-2.5" : "px-4 py-3.5",
        cor === "critical"
          ? "bg-[var(--status-critical-bg)]"
          : "bg-[var(--status-warning-bg)]",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 font-semibold uppercase tracking-[0.04em]",
          compacto ? "text-xs" : "text-sm",
          cor === "critical"
            ? "text-[var(--status-critical)]"
            : "text-[var(--status-warning)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            cor === "critical" ? "bg-[var(--status-critical)]" : "bg-[var(--status-warning)]",
          )}
        />
        {aviso.titulo}
      </p>
      <p
        className={cn(
          "mt-1.5 text-foreground",
          compacto ? "text-xs leading-5" : "text-sm leading-6",
        )}
      >
        {aviso.explicacao}
      </p>
      {!compacto && aviso.passadas.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {aviso.passadas.map((passada, i) => (
            <li
              key={`${passada.passada}-${i}`}
              className="font-mono text-xs text-muted-foreground"
            >
              Etapa que falhou: {passada.passada}
              {passada.motivo ? `: ${passada.motivo}` : ""}
            </li>
          ))}
        </ul>
      )}
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}
