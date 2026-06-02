import { cn } from "@/lib/utils";
import type { VolumeStatus } from "@/modules/volume-builder/lib/volume/volume-types";

interface StatusBadgeProps {
  status: VolumeStatus;
  className?: string;
}

const statusConfig: Record<
  VolumeStatus,
  { label: string; className: string }
> = {
  sem_problemas: {
    label: "OK",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  ponto_de_atencao: {
    label: "Atencao",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  problema_de_montagem: {
    label: "Problema",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
