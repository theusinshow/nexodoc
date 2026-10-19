import { AVISO_DE_RESPONSABILIDADE } from "@/lib/aviso-de-responsabilidade";

import "./aviso-de-responsabilidade.css";

/**
 * O AVISO FIXO de responsabilidade, igual em toda tela que mostra o parecer.
 *
 * Discreto de propósito: nota de rodapé em texto terciário, sem moldura nem cor
 * de status — o sinal é do veredito, e este aviso não compete com ele. Não tem
 * botão de fechar: aviso que se dispensa deixa de ser aviso.
 */
export function AvisoDeResponsabilidade({ className }: { className?: string }) {
  return (
    <p role="note" data-aviso-de-responsabilidade className={className ? `ar-aviso ${className}` : "ar-aviso"}>
      {AVISO_DE_RESPONSABILIDADE}
    </p>
  );
}
