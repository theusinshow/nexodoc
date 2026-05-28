import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { label: "Template" },
  { label: "Dados Gerais" },
  { label: "Grupos" },
  { label: "Previa" },
  { label: "Resumo" },
  { label: "Resultado" },
] as const;

interface StepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function Stepper({ currentStep, onStepClick, className }: StepperProps) {
  const total = STEPS.length;
  const progress = Math.round(((currentStep + 1) / total) * 100);

  return (
    <nav className={className} aria-label="Progresso">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Etapa {currentStep + 1} de {total}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {progress}%
        </span>
      </div>

      <div className="relative flex items-center justify-between">
        <div className="absolute left-2 right-2 top-3.5 h-1 overflow-hidden bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <div key={step.label} className="relative flex flex-col items-center">
              <Button
                type="button"
                variant="outline"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(index)}
                className={`relative z-10 flex h-8 w-8 items-center justify-center border-2 font-mono text-xs font-bold transition-all duration-300
                  ${isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-card text-primary hover:bg-primary/10 cursor-pointer"
                      : "border-border bg-card text-muted-foreground cursor-default"
                  }`}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.label}${isCompleted ? " (concluido)" : ""}`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </Button>
              <span
                className={`mt-2 text-center font-mono text-[11px] font-medium leading-tight transition-colors duration-300
                  ${isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
