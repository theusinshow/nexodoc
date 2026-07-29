"use client";

/**
 * O centro da tela deixa de ser "o canvas" e vira PALCO com vistas.
 *
 * Duas vistas: o mapa do volume (os documentos gerados) e a auditoria (em curso
 * ou concluída). Quem manda é o trabalho: começou uma auditoria, o palco passa a
 * mostrá-la; terminou, mostra o parecer. O usuário volta ao mapa quando quiser.
 *
 * O relatório é o MESMO componente da tela dedicada (`components/audit-result`),
 * não uma cópia pobre: reescrevê-lo custaria o visor de PDF, a matriz por
 * disciplina e as duas camadas de confiança — o que dá credibilidade ao parecer.
 */

import { type ReactNode } from "react";
import { Map, ShieldCheck } from "lucide-react";

import { AuditResult } from "@/components/audit-result";
import { Chip } from "@/components/ui/chip";
import type { MemorialAuditResult } from "../lib/audit";
import { useConversation } from "../state/conversation-store";
import { useAuditoria, type VistaDoPalco as Vista } from "../state/auditoria-store";
import { AuditoriaEmCurso } from "./AuditoriaEmCurso";
import { useReconectarAuditoria } from "./use-reconectar-auditoria";

export function PalcoDoNexo({ mapa }: { mapa: ReactNode }) {
  const { results } = useConversation();
  const { emCurso, escolha, escolherVista } = useAuditoria();
  // Auditoria herdada de outra sessão (F5, troca de conversa): o palco volta a
  // esperar por ela em vez de deixá-la morrer com a aba.
  const reconexao = useReconectarAuditoria();

  const auditoria = results.find((r) => r.kind === "auditoria");
  const salvo = auditoria?.payload as MemorialAuditResult | undefined;
  const report = salvo?.report;
  const temAuditoria = Boolean(emCurso || reconexao.pendente || report);

  /*
   * A vista é DERIVADA, não sincronizada por effect.
   *
   * O padrão é seguir o trabalho: havendo auditoria, é ela que aparece — senão o
   * usuário dispara a análise e continua olhando o mapa, sem sinal de que algo
   * acontece. A escolha manual vale enquanto for a MESMA auditoria: quando outra
   * começa, a marca muda, a escolha antiga caduca e o palco volta a seguir o
   * trabalho. Um `useEffect` com setState faria o mesmo com renders em cascata —
   * e o lint do React Compiler barra, com razão.
   *
   * A escolha mora no store, e não aqui, porque o chat também a comanda: o "Ver
   * o parecer" da âncora usa a marca coringa `"*"`, que vale para a auditoria
   * que estiver na tela.
   */
  const marca = emCurso
    ? `curso:${emCurso.inicioMs}`
    : reconexao.pendente
      ? `retomada:${reconexao.pendente.inicioMs}`
      : report
        ? "pronta"
        : "vazio";
  const valeAgora = escolha && (escolha.marca === marca || escolha.marca === "*");
  const vista: Vista = valeAgora
    ? escolha.vista
    : temAuditoria
      ? "auditoria"
      : "mapa";
  const escolher = (v: Vista) => escolherVista(marca, v);

  const mostrandoAuditoria = vista === "auditoria" && temAuditoria;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/*
        O seletor só aparece quando há duas vistas de fato. Com uma só, ele seria
        um controle que não controla nada.
      */}
      {temAuditoria && (
        <div className="flex shrink-0 items-center gap-1 px-1 pb-2">
          <Chip
            variant={mostrandoAuditoria ? "quiet" : "default"}
            onClick={() => escolher("mapa")}
            className="min-h-7 px-2.5 py-0.5 text-[11px]"
          >
            <Map aria-hidden />
            Mapa do volume
          </Chip>
          <Chip
            variant={mostrandoAuditoria ? "default" : "quiet"}
            onClick={() => escolher("auditoria")}
            className="min-h-7 px-2.5 py-0.5 text-[11px]"
          >
            <ShieldCheck aria-hidden />
            Auditoria
          </Chip>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {mostrandoAuditoria ? (
          emCurso ? (
            <div className="flex h-full items-start justify-center overflow-y-auto pt-6">
              <AuditoriaEmCurso
                nivel={emCurso.nivel}
                arquivo={emCurso.arquivo}
                inicioMs={emCurso.inicioMs}
                marcos={emCurso.marcos}
                onCancelar={emCurso.cancelar}
              />
            </div>
          ) : reconexao.pendente ? (
            /*
             * Retomada: sem marcos, porque o fluxo de eventos morreu junto com a
             * conexão anterior. Inventar etapas para preencher a espera seria a
             * animação que este módulo se recusa a fazer — a tela diz só o que
             * sabe, e o resultado aparece quando o servidor terminar.
             */
            <div className="flex h-full items-start justify-center overflow-y-auto pt-6">
              <AuditoriaEmCurso
                nivel={reconexao.pendente.nivel}
                arquivo={reconexao.pendente.arquivo}
                inicioMs={reconexao.pendente.inicioMs}
                marcos={[]}
                retomada
              />
            </div>
          ) : report ? (
            <div className="h-full overflow-y-auto">
              <AuditResult
                content={salvo?.texto ?? ""}
                report={report}
                auditId={salvo?.auditId ?? undefined}
              />
            </div>
          ) : null
        ) : (
          mapa
        )}
      </div>
    </div>
  );
}
