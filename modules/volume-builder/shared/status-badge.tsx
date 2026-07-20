import { Badge } from "@/components/ui/badge";
import type { VolumeStatus } from "@/modules/volume-builder/lib/volume/volume-types";

interface StatusBadgeProps {
  status: VolumeStatus;
  className?: string;
}

// Mapeia o status de volume para o vocabulario unico de status do sistema
// (Badge variants). Antes usava cores Tailwind de light-mode (green-100 etc.)
// que destoavam do app dark.
const statusConfig: Record<
  VolumeStatus,
  { label: string; variant: "ok" | "warning" | "critical" }
> = {
  sem_problemas: { label: "OK", variant: "ok" },
  ponto_de_atencao: { label: "Atencao", variant: "warning" },
  problema_de_montagem: { label: "Problema", variant: "critical" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
