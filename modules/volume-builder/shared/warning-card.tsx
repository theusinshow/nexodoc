import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface WarningCardProps {
  warnings: string[];
  className?: string;
}

export function WarningCard({ warnings, className }: WarningCardProps) {
  if (warnings.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
        <ul className="space-y-1">
          {warnings.map((warning, index) => (
            <li key={index} className="text-xs text-[var(--status-warning)]">
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
