"use client";

/**
 * "O VOLUME QUE VOCÊ BAIXOU FICOU VELHO" — e o botão que conserta.
 *
 * O caso real: o engenheiro montou o volume, baixou, viu o título da LD errado,
 * pediu a correção ao chat, e teve de pedir mais duas vezes — "monta de novo",
 * "baixa de novo". Três pedidos para uma correção que o Nexo tinha como
 * oferecer sozinha no primeiro. E, enquanto ele não pedia, o card do volume
 * seguia dizendo "Gerado", com a LD velha encadernada dentro.
 *
 * DERIVADO, não uma mensagem. Ele nasce de `results` e mora no fim da conversa:
 * aparece no instante em que vira verdade e some no instante em que o volume é
 * remontado. Injetado no histórico como mensagem, ficaria congelado lá,
 * mentindo depois de resolvido.
 *
 * UM CARD SÓ para todos os volumes afetados. Seis tomos velhos empilhariam seis
 * cards iguais — o mesmo motivo pelo qual o `PlanoDeGeracao` já unificou
 * capa/LD/separatriz num card só.
 *
 * A MONTAGEM CONTINUA UMA SÓ: este card não sabe montar volume. Ele chama o
 * montador que o card do volume registrou (`montadores-de-volume.tsx`), com
 * todas as travas que moram lá.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { palavra, plural } from "@/lib/plural";
import { baixarArquivosEmZip } from "../lib/editaveis";
import { nomeDoZipDosVolumes } from "../lib/nome-do-volume";
import { volumesDesatualizados } from "../lib/volumes-desatualizados";
import { volumesProntosDosResultados } from "../lib/volumes-prontos";
import { useConversation, type SavedResult } from "../state/conversation-store";
import { useMontadoresDeVolume } from "../state/montadores-de-volume";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

const LABEL_CLASS =
  "font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground";

/** O número do volume, dos params da capa — ver `volumeDeclaradoNaCapa`. */
function volumeDaCapa(results: readonly SavedResult[]): string {
  for (const r of results) {
    if (r.kind !== "capa") continue;
    const v = (r.payload as { volume?: unknown } | undefined)?.volume;
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export function VolumesDesatualizados({
  selos,
  temPranchas,
}: {
  selos: SeloForLd[];
  /**
   * Os bytes das pranchas estão nesta máquina?
   *
   * Eles vivem em memória (estado do workspace): depois de um F5, ou numa
   * conversa retomada noutra máquina, não existem mais — e remontar sem eles
   * entregaria um volume com capa, separatriz e LD e NADA dentro. O card então
   * diz o que aconteceu em vez de desenhar um botão que não funciona.
   */
  temPranchas: boolean;
}) {
  const { results, identidade, podeGastar, motivoParaNaoGastar, motivoDaTrava } =
    useConversation();
  const { montador } = useMontadoresDeVolume();

  const velhos = useMemo(() => volumesDesatualizados(results), [results]);

  const [montando, setMontando] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<{ rotulo: string; motivo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  /*
   * O DOWNLOAD ESPERA OS BYTES NOVOS.
   *
   * Baixar logo depois do laço de montagem entregaria o PDF ANTIGO: `results` é
   * estado do React, e o array que esta função capturou é o de antes das
   * gravações. Pior — a URL antiga é revogada quando o artefato é regravado, e
   * o download falharia em silêncio.
   *
   * Então o clique só ANOTA o que baixar e desde quando; o efeito abaixo
   * observa `results` e dispara quando cada volume pedido já foi regravado.
   * Reagir ao estado é a única forma de saber que os bytes novos chegaram sem
   * ficar cutucando o relógio.
   */
  const [aBaixar, setABaixar] = useState<{ ids: string[]; desde: number } | null>(null);
  const baixando = aBaixar !== null;
  /** Trava de reentrada: o efeito reage a `results`, que muda mais de uma vez. */
  const emCurso = useRef(false);

  useEffect(() => {
    if (!aBaixar || emCurso.current) return;
    const pedidos = aBaixar.ids.map((id) => results.find((r) => r.artifactId === id));
    // Ainda não chegaram os bytes novos de todos: espera o próximo `results`.
    if (pedidos.some((r) => !r || (r.generatedAt ?? 0) < aBaixar.desde)) return;

    const prontos = volumesProntosDosResultados(
      pedidos.filter((r): r is SavedResult => Boolean(r)),
    );
    emCurso.current = true;

    void (async () => {
      try {
        if (prontos.length === 1) {
          // Um volume é um arquivo: embrulhá-lo num ZIP só daria trabalho a
          // quem for abrir.
          const a = document.createElement("a");
          a.href = prontos[0].url;
          a.download = prontos[0].nome;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else if (prontos.length > 1) {
          await baixarArquivosEmZip(
            prontos,
            nomeDoZipDosVolumes(selos, identidade, volumeDaCapa(results)),
          );
        }
      } catch (err) {
        setErro(
          err instanceof Error ? err.message : "Falha ao baixar os volumes remontados.",
        );
      } finally {
        emCurso.current = false;
        setABaixar(null);
      }
    })();
  }, [aBaixar, results, selos, identidade]);

  if (velhos.length === 0) return null;

  const semMontador = velhos.filter((v) => !montador(v.artifactId));
  const podeRemontar = temPranchas && semMontador.length < velhos.length;

  async function remontarEBaixar() {
    /*
     * A ABA TRAVADA NÃO REMONTA — revisão final da segunda rodada, 15/09/2026.
     * Este botão chama, por volume, o `confirm` registrado em
     * `montadores-de-volume.tsx` — o MESMO que roda a conferência paga
     * (`conferirVolume`). Ele já recusa sozinho (devolve o motivo, que cairia
     * em `falhas`), mas travar aqui evita um laço inteiro de "falhas" com o
     * mesmo motivo e dá a resposta de uma vez, antes de tentar.
     */
    if (!podeGastar) {
      setErro(motivoDaTrava());
      return;
    }
    setErro(null);
    setFalhas([]);
    const coletadas: { rotulo: string; motivo: string }[] = [];
    const desde = Date.now();
    const refeitos: string[] = [];
    try {
      /*
       * SEQUENCIAL, cada um no seu `try` — a mesma regra do "montar todos", pelo
       * mesmo motivo: cada volume carrega dezenas de megabytes, e um que falha
       * não pode levar os outros junto nem sumir em silêncio.
       */
      for (let i = 0; i < velhos.length; i++) {
        const montar = montador(velhos[i].artifactId);
        if (!montar) {
          coletadas.push({
            rotulo: velhos[i].rotulo,
            motivo: "o card deste volume não está mais na conversa",
          });
          continue;
        }
        setMontando(i);
        try {
          const motivo = await montar();
          if (motivo) coletadas.push({ rotulo: velhos[i].rotulo, motivo });
          else refeitos.push(velhos[i].artifactId);
        } catch (err) {
          coletadas.push({
            rotulo: velhos[i].rotulo,
            motivo: err instanceof Error ? err.message : "erro desconhecido",
          });
        }
      }
    } finally {
      setMontando(null);
      setFalhas(coletadas);
      if (refeitos.length > 0) setABaixar({ ids: refeitos, desde });
    }
  }

  const ocupado = montando !== null || baixando;

  return (
    <div
      data-state="pendente"
      className="nexodoc-enter rounded-md border border-[var(--status-warning)]/45 bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-warning)]" aria-hidden />
        <span className={LABEL_CLASS}>
          {palavra(velhos.length, "Volume desatualizado", "Volumes desatualizados")}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-3 py-3">
        <p className="text-xs leading-5 text-[var(--status-warning)]">
          {velhos.length === 1
            ? "Este volume foi montado antes da última correção — o PDF que você baixou está velho."
            : `Estes ${velhos.length} volumes foram montados antes da última correção — os PDFs que você baixou estão velhos.`}
        </p>

        <ul className="grid gap-1.5">
          {velhos.map((v) => (
            <li key={v.artifactId} className="text-xs leading-5">
              <span className="font-mono text-foreground">· {v.rotulo}</span>
              {/* O MOTIVO com o nome da peça: "desatualizado" sozinho manda o
                  engenheiro adivinhar o que mudou, e é a diferença entre
                  confiar no aviso e ignorá-lo. */}
              <span className="text-muted-foreground"> — {v.motivos.join("; ")}</span>
            </li>
          ))}
        </ul>

        {podeRemontar ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={remontarEBaixar}
              disabled={ocupado || !podeGastar}
              title={podeGastar ? undefined : (motivoParaNaoGastar ?? undefined)}
              /* Âmbar porque é RESPOSTA a algo que envelheceu, não ação nova —
                 a mesma regra do botão do card pendente. */
              className={
                ocupado || !podeGastar
                  ? undefined
                  : "border-[var(--status-warning)] bg-[var(--status-warning)] text-[#2b1d05] hover:bg-[var(--status-warning)]/90"
              }
            >
              {ocupado ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />
              )}
              {montando !== null
                ? `Remontando ${montando + 1} de ${velhos.length}…`
                : baixando
                  ? "Preparando o download…"
                  : velhos.length === 1
                    ? "Remontar e baixar"
                    : `Remontar e baixar os ${velhos.length}`}
            </Button>
            {!podeGastar && (
              <span className="text-xs text-muted-foreground">
                {motivoParaNaoGastar}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            {temPranchas
              ? "Para remontar, abra o card do volume nesta conversa."
              : "Os arquivos das pranchas não estão nesta máquina — anexe a pasta de novo para remontar."}
          </p>
        )}

        {falhas.length > 0 && (
          <p className="text-xs text-[var(--destructive)]">
            {plural(falhas.length, "volume não remontou", "volumes não remontaram")}:{" "}
            {falhas.map((f) => `${f.rotulo} (${f.motivo})`).join("; ")}.
          </p>
        )}
        {erro && <p className="text-xs text-[var(--destructive)]">{erro}</p>}
      </div>
    </div>
  );
}
