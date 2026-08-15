import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuditModeLabel, type AuditMode } from "@/lib/audit-mode";

type AuditProgressProps = {
  fileCount: number;
  auditMode: AuditMode;
  elapsedMs: number;
  onCancel: () => void;
};

function formatElapsed(elapsedMs: number) {
  return `${Math.max(1, Math.floor(elapsedMs / 1000))}s`;
}

/*
 * A FRASE DA FASE É UMA ESTIMATIVA POR CRONÔMETRO, e é importante saber disso
 * antes de mexer aqui: ela não lê o estado do pipeline, lê o relógio. Quando o
 * servidor sai do ritmo esperado, ela mente.
 *
 * Foi por isso que esta região NÃO ganhou um stepper de etapas em foco: desenho
 * de precisão sobre dado inventado comunica "o sistema sabe em que passo está"
 * com muito mais autoridade do que uma linha de texto — e quanto melhor o
 * desenho, pior a promessa falsa. O brilho abaixo diz "trabalhando", que é
 * verdade; não diz "estou no passo 2 de 5", que não é.
 *
 * Ligar isto ao estado real é trabalho de servidor e está registrado na spec
 * (docs/superpowers/specs/2026-08-15-elevacao-visual-design.md, §5).
 */
function getCurrentStep(elapsedMs: number, auditMode: AuditMode) {
  const seconds = elapsedMs / 1000;

  if (seconds < 3) {
    return "Recebendo PDFs e preparando leitura";
  }

  if (seconds < 8) {
    return "Extraindo texto e identidade global";
  }

  if (seconds < 30) {
    return auditMode === "volume"
      ? "Auditando LD, selos, pranchas e consistencia do volume"
      : "Auditando coerencia interna e trechos reaproveitados";
  }

  return "Analisando blocos em paralelo; o servidor segue trabalhando";
}

export function AuditProgress({
  fileCount,
  auditMode,
  elapsedMs,
  onCancel,
}: AuditProgressProps) {
  return (
    /*
     * CHANFRO, NÃO RAIO. Esta região usava `rounded-sm`/`rounded-md`/`rounded-full`
     * — o vocabulário anterior ao chanfro virar a geometria do sistema
     * (DESIGN.md §11: o raio sobrevive em três lugares, e nenhum é este).
     */
    <section className="nexodoc-result-in nx-edge-6 w-full max-w-[760px] px-5 py-5 text-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              {/*
                O TEXTO É O INDICADOR, e o spinner saiu.
                Havia um `Loader2 animate-spin` estacionado nesta região, contra
                o §11 ("não estacione spinner numa região de conteúdo"). Ele
                girava igual do primeiro ao último segundo — movimento que não é
                mudança de estado, que é a definição de decoração no §5.
                A lâmina que atravessa a frase diz a mesma coisa e diz sobre o
                conteúdo, não ao lado dele.
              */}
              <p className="nx-shiny font-medium text-foreground">
                {getCurrentStep(elapsedMs, auditMode)}
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {getAuditModeLabel(auditMode)} com {fileCount}{" "}
                {fileCount === 1 ? "arquivo" : "arquivos"}.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-start gap-2 md:justify-end">
              <span className="nx-cut-4 flex h-9 min-w-12 items-center justify-center bg-[var(--nexodoc-recessed)] px-2 font-mono text-xs tabular-nums text-muted-foreground">
                {formatElapsed(elapsedMs)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
              >
                <X />
                Cancelar
              </Button>
            </div>
          </div>

          {/* A barra indeterminada permanece: ela não afirma posição, afirma
              atividade — e é o único movimento contínuo que sobra aqui. */}
          <div className="h-1.5 overflow-hidden bg-muted">
            <div className="audit-progress-bar h-full w-1/2 bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
