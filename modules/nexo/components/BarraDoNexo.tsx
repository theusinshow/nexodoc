"use client";

/**
 * A barra do topo: em repouso diz de QUAL OBRA é esta conversa; enquanto uma
 * auditoria roda, cede o lugar ao progresso dela.
 *
 * Existe porque a faixa que estava aqui mostrava a palavra "NEXO" e nada mais —
 * resíduo do AppShell genérico. Marca e conta não cabiam: a barra lateral já faz
 * as duas coisas, e melhor. O que sobra para uma faixa horizontal é o que muda
 * com a conversa (a obra) e o que muda com o tempo (o trabalho pesado).
 *
 * NÃO RENDERIZA quando não há nem obra nem auditoria. Uma faixa dizendo "nenhum
 * documento lido ainda" passaria a maior parte do tempo declarando ignorância,
 * que é justamente o defeito que ela veio corrigir. O preço é o layout deslocar
 * quando ela nasce, e esse preço foi aceito no spec.
 *
 * O progresso de capas/LD/volume NÃO entra aqui: aquele `busy` é `useState`
 * dentro de cada cartão e morre com ele. Elevá-lo é outro trabalho — e prometer
 * na barra o que não se sabe seria pior do que não prometer.
 */

import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { contextoDaBarra } from "../lib/contexto-da-barra";
import { resumoDaAuditoria } from "../lib/resumo-da-auditoria";
import { auditoriaDaConversa, useAuditoria } from "../state/auditoria-store";
import { useConversation } from "../state/conversation-store";
import { MarcaDaPrefeitura } from "./MarcaDaPrefeitura";

export function BarraDoNexo() {
  const { conversationId, identidade, seloResults } = useConversation();
  const { emCurso } = useAuditoria();

  const auditando = auditoriaDaConversa(emCurso, conversationId);
  const contexto = contextoDaBarra({ identidade, seloResults });

  // Nada a afirmar: a barra não existe, e o palco fica com a altura inteira.
  if (!auditando && !contexto) return null;

  if (auditando) {
    const { rotulo, contagem } = resumoDaAuditoria(auditando.marcos);
    return (
      <div className="nexo-barra" data-camada="trabalho" role="status" aria-live="polite">
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-primary"
          strokeWidth={1.8}
          aria-hidden
        />
        {/* Um nível só desde 17/08/2026 — ver `requirements.ts`. */}
        <span className="nexo-barra__rotulo">Auditoria</span>
        <span className="nexo-barra__obra" title={auditando.arquivo}>
          {auditando.arquivo}
        </span>
        <span className="nexo-barra__etapa">
          {rotulo}
          {contagem ? ` — ${contagem}` : ""}
        </span>
        {auditando.cancelar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0"
            onClick={auditando.cancelar}
          >
            <X />
            Cancelar
          </Button>
        )}
      </div>
    );
  }

  // Repouso. `contexto` é não-nulo aqui: o retorno acima já cobriu o outro caso.
  const { obra, orgao, codigo } = contexto!;
  return (
    <div className="nexo-barra" data-camada="repouso">
      {/*
        O SELO, e não o sinal: a faixa é uma SUPERFÍCIE LARGA, e ali os 31px do
        sinal se perderiam entre o nome da obra e o código.

        Ele só existe na camada de REPOUSO. Enquanto a auditoria roda, a faixa
        deixa de falar da obra e passa a falar do trabalho — e marca de
        identidade ao lado de barra de progresso disputa o olho com o único
        campo que muda ali.

        A COR VEM DO ÓRGÃO, que é opcional: sem órgão, marca cinza. Não é
        degradação — a faixa nasce da leitura dos selos, e "ainda não sei de
        quem é esta obra" é um estado real do minuto zero.
      */}
      <MarcaDaPrefeitura prefeitura={orgao} forma="selo" />
      <span className="nexo-barra__obra" title={obra}>
        {obra}
      </span>
      {orgao && <span className="nexo-barra__orgao">{orgao}</span>}
      {codigo && <span className="nexo-barra__codigo">{codigo}</span>}
    </div>
  );
}
