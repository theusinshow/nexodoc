import { AVISO_DE_RESPONSABILIDADE } from "@/lib/aviso-de-responsabilidade";
import { cn } from "@/lib/utils";

/**
 * O AVISO FIXO de responsabilidade, igual em toda tela que mostra o parecer.
 *
 * Discreto de propósito: texto pequeno, cor de apoio, sem moldura nem cor de
 * status — o sinal é do veredito, e este aviso não compete com ele. Não tem
 * botão de fechar: aviso que se dispensa deixa de ser aviso.
 */
export function AvisoDeResponsabilidade({ className }: { className?: string }) {
  return (
    <p
      role="note"
      data-aviso-de-responsabilidade
      className={cn("max-w-[76ch] text-xs leading-relaxed text-muted-foreground", className)}
    >
      {AVISO_DE_RESPONSABILIDADE}
    </p>
  );
}
