"use client";

import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SavedResult } from "../state/conversation-store";
import { temAlgoADizer } from "../lib/links-do-resultado";
import { tamanhoLegivel } from "../lib/pendencia";

/** Mapeia os arquivos salvos p/ o formato do ResultLinks. */
export function toResultFiles(saved: SavedResult) {
  return saved.files.map((f) => ({
    label: f.label,
    url: f.url,
    name: f.name,
    primary: f.primary,
    sizeBytes: f.sizeBytes,
  }));
}

/**
 * Os links de download de um artefato já gerado.
 *
 * Recebe o resultado inteiro, e não só a lista de arquivos, de propósito: a
 * marca `bytesAusentes` mora nele, e um parâmetro à parte seria esquecido em um
 * dos lugares que chamam isto — que é exatamente como um aviso importante some.
 *
 * Vive em arquivo próprio (e não dentro do ConfirmationCard, onde nasceu)
 * porque o card do PLANO também precisa dele: era o único caminho que gerava a
 * LD sem oferecer o ODT, e duplicar o componente teria deixado o aviso de bytes
 * ausentes para trás na cópia.
 *
 * NÃO GERA NADA POR CONTA PRÓPRIA: os arquivos já estão no IndexedDB, e `url`
 * é object URL vivo. Nenhuma chamada de servidor, nenhum token. Quando os bytes
 * faltam, quem sabe refazer é o card que chamou — daí `onRegerar` ser prop, e
 * não uma chamada daqui.
 */
export function ResultLinks({
  summary,
  saved,
  onRegerar,
  regerando,
  motivoRegerarBloqueado,
}: {
  summary?: string;
  saved: SavedResult;
  /**
   * Refaz este artefato. Opcional: onde não há caminho determinístico de
   * regeneração, o botão não nasce — prometer um gesto que não existe é pior
   * que não oferecer nenhum.
   */
  onRegerar?: () => void | Promise<unknown>;
  regerando?: boolean;
  /**
   * Por que "Regenerar" está cinza mesmo com `onRegerar` definido — por
   * exemplo, a aba travada (`MOTIVO_ABA_TRAVADA`, ver `lib/aba-travada.ts`): o
   * clique chamaria o mesmo `confirm` que gastaria de novo, e a fila de
   * gravação desta aba descartaria o resultado. `null`/`undefined` deixa o
   * botão como sempre foi — quem não passa a prop não muda de comportamento.
   */
  motivoRegerarBloqueado?: string | null;
}) {
  const files = toResultFiles(saved);
  if (!temAlgoADizer(saved)) return null;
  return (
    <div className="nx-edge-6 flex flex-col gap-2 p-3 [--nx-fill:var(--nexodoc-recessed)]">
      {summary && <p className="text-sm">{summary}</p>}
      {/*
        O ARTEFATO EXISTE, OS BYTES NÃO ESTÃO AQUI.

        Acontece com conversa aberta noutra máquina: o registro atravessa a
        rede, os arquivos não — eles ficam no navegador que os gerou. Antes
        disto o arquivo simplesmente não aparecia, e um card sem botão de baixar
        parece defeito. Dizer o que houve e o que fazer custa duas linhas.
      */}
      {saved.bytesAusentes && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs leading-snug text-[var(--status-warning)]">
            Gerado em outra máquina — os arquivos não estão neste navegador.
            {onRegerar ? " Refaça para baixar." : " Gere de novo para baixar."}
          </p>
          {/*
            O BOTÃO QUE A FRASE PEDIA.

            A tela mandava "gere de novo" e não oferecia o gesto: não existia a
            palavra "Regenerar" em lugar nenhum do produto, e quem lia o aviso
            tinha de descobrir sozinho por onde refazer. O caminho determinístico
            já existia — é o mesmo `confirm()` que gerou da primeira vez. Só
            faltava o botão chamá-lo.

            `variant="outline"`: refazer não é a ação primária do card, e o
            primário aqui é baixar. Quando não há arquivo nenhum para baixar,
            ele é o único botão — e continua sendo o certo, porque a decisão de
            gastar de novo não deve parecer o caminho óbvio.
          */}
          {onRegerar && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                loading={regerando}
                onClick={() => void onRegerar()}
                data-prova="regerar-artefato"
                disabled={Boolean(motivoRegerarBloqueado)}
                title={motivoRegerarBloqueado ?? undefined}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Regenerar
              </Button>
              {motivoRegerarBloqueado && (
                <span className="text-xs text-muted-foreground">
                  {motivoRegerarBloqueado}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {files.map((f) => {
          /* O peso do arquivo é decisão prática: o engenheiro escolhe o que
             anexa no e-mail da prefeitura por tamanho, e descobrir 18 MB só
             depois de baixar é tarde. */
          const peso = tamanhoLegivel(f.sizeBytes);
          return (
            <Button
              key={f.label}
              size="sm"
              variant={f.primary ? "default" : "outline"}
              asChild
            >
              <a href={f.url} download={f.name} data-prova="baixar-artefato">
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {f.label}
                {peso && (
                  <span className="ml-1.5 text-[11px] font-normal opacity-70">
                    {peso}
                  </span>
                )}
              </a>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
