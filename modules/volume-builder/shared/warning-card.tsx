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
        "rounded-lg border border-yellow-200 bg-yellow-50 p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
        <ul className="space-y-1">
          {warnings.map((warning, index) => (
            <li key={index} className="text-xs text-yellow-800">
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
