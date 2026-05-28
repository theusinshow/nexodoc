"use client";

import { Link } from "lucide-react";

interface LdIntegrationBannerProps {
  data: {
    codigoInterno?: string;
    codigoExibido?: string;
    revisao?: string;
    nomeObra?: string;
    fase?: string;
    orgao?: string;
  };
}

export function LdIntegrationBanner({ data }: LdIntegrationBannerProps) {
  const hasData = Object.values(data).some((v) => v);

  if (!hasData) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Link className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Dados herdados do Criador de LDs</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Os campos abaixo foram pre-preenchidos a partir da LD. Voce pode
            editar qualquer campo antes de gerar as capas.
          </p>
          {data.nomeObra && (
            <p className="text-xs text-muted-foreground mt-2">
              LD: <span className="font-medium">{data.nomeObra}</span>
              {data.codigoInterno && (
                <span> | Codigo: {data.codigoInterno}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
