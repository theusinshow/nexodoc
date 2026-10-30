"use client";

/**
 * O CARTÃO CURTO DA MONTAGEM (06/10/2026). No lugar da pilha de cartões por
 * tomo ("Montar volume" × 6, cada um com Folhas/Título/Partes): antes, um botão
 * para o conjunto; durante, a barra; depois, "pronto — veja no canvas". O
 * detalhe de cada tomo mora no canvas.
 */
import { CircleCheck, LayoutGrid } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

import { formatarMb, tomosMontados } from "../lib/entrega-do-volume";
import { progressoDoLote, rotuloDaFase } from "../lib/progresso-da-montagem";
import { useAuditoria } from "../state/auditoria-store";
import { useConversation } from "../state/conversation-store";
import { useFasesDaMontagem, useGeradorDoPlano } from "../state/montadores-de-volume";
import { useMontarTodos } from "../state/use-montar-todos";
import { PerguntaDaRedeDoVolume } from "./PerguntaDaRedeDoVolume";
import { BarraDaMontagem } from "./ProgressoDaMontagem";

export function CartaoDaMontagem({ selos }: { selos: SeloForLd[] }) {
  const { results, podeGastar, motivoParaNaoGastar } = useConversation();
  const { fases, situacoes } = useFasesDaMontagem();
  const { escolherVista } = useAuditoria();
  const { gerador, gerar } = useGeradorDoPlano();
  const m = useMontarTodos(selos);

  const lista = m.tomos.map((t) => fases[t.id]);
  const p = progressoDoLote(lista);
  const montados = useMemo(() => tomosMontados(results), [results]);
  const doConjunto = montados.filter((t) => m.tomos.some((x) => x.id === t.id));
  const peso = doConjunto.reduce((s, t) => s + (t.bytes ?? 0), 0);
  const bloqueio = m.tomos.map((t) => situacoes[t.id]?.bloqueio).find(Boolean) ?? null;
  const semMontador = m.tomos.every((t) => !situacoes[t.id]);
  const n = m.tomos.length;
  const atual = p.atual >= 0 ? m.tomos[p.atual] : undefined;
  const pronto = !p.emCurso && doConjunto.length === n && n > 0;

  return (
    <section className="flex flex-col gap-2.5 rounded-md border border-border bg-card p-3" data-prova="cartao-da-montagem" aria-label="Montagem do volume">
      {p.emCurso ? (
        <>
          <span className="text-xs font-medium" aria-live="polite">
            Montando {n > 1 ? `os volumes · ${p.prontos} de ${n} prontos` : "o volume"}
          </span>
          <BarraDaMontagem fases={lista} rotulo="Progresso da montagem" />
          {atual && (
            <span className="text-xs text-muted-foreground">
              {atual.rotulo} · {rotuloDaFase(fases[atual.id], undefined)}
            </span>
          )}
        </>
      ) : pronto ? (
        <span className="flex items-center gap-2 text-xs" data-prova="montagem-pronta">
          <CircleCheck className="h-4 w-4 text-[var(--status-ok)]" aria-hidden />
          {n > 1 ? `${n} tomos montados` : "Volume montado"} · {formatarMb(peso)}
        </span>
      ) : semMontador ? (
        /*
         * SEM CAPA E LD NÃO HÁ O QUE MONTAR (06/10/2026): antes o botão ficava
         * cinza sem dizer por quê, e o teste real terminou em "MONTE OS
         * VOLUMES" três vezes. Diz o que falta e oferece o passo.
         */
        <span className="text-xs">
          {gerador?.gerando ? "Gerando a capa, a LD e a separatriz…" : "Antes de montar, confira a capa no plano acima e gere a capa e a LD."}
        </span>
      ) : (
        <span className="text-xs">
          {n > 1 ? `${n} tomos prontos para montar.` : "O volume está pronto para montar."}
        </span>
      )}

      {/* Onde as LDs ficam na rede: pergunta, e trava montar e baixar até alguém responder. */}
      {!p.emCurso && <PerguntaDaRedeDoVolume selos={selos} />}

      <div className="flex flex-wrap items-center gap-2">
        {!p.emCurso && semMontador && gerador && (
          <Button size="sm" loading={gerador.gerando} disabled={gerador.gerando || Boolean(gerador.bloqueio)} onClick={() => void gerar()}>
            Gerar capa e LD
          </Button>
        )}
        {!p.emCurso && !semMontador && (
          <Button
            size="sm"
            variant={pronto ? "secondary" : "default"}
            disabled={!podeGastar || semMontador || Boolean(bloqueio)}
            title={!podeGastar ? (motivoParaNaoGastar ?? undefined) : undefined}
            onClick={() => void m.montarTodos()}
          >
            {pronto ? "Montar de novo" : n > 1 ? `Montar os ${n} volumes` : "Montar o volume"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => escolherVista("*", "mapa")}>
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Ver no canvas
        </Button>
      </div>

      {!p.emCurso && semMontador && gerador?.bloqueio && <p className="text-xs text-muted-foreground">{gerador.bloqueio}</p>}
      {!p.emCurso && semMontador && !gerador && (
        <p className="text-xs text-muted-foreground">Peça a capa e a LD no chat (&ldquo;cria a LD e a capa&rdquo;).</p>
      )}
      {!p.emCurso && bloqueio && <p className="text-xs text-muted-foreground">{bloqueio.charAt(0).toUpperCase() + bloqueio.slice(1)}.</p>}
      {m.falhas.length > 0 && (
        <p className="text-xs text-[var(--destructive)]">
          {m.falhas.map((f) => `${f.rotulo}: ${f.motivo}`).join("; ")}
        </p>
      )}
    </section>
  );
}
