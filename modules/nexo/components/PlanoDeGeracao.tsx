"use client";

/**
 * UM card por turno para tudo que o Nexo vai gerar.
 *
 * Antes cada proposta virava um card com seu botão, e a divisão em tomos
 * multiplicava: 2 tomos = 6 caixas de "confirmar e gerar" antes de chegar ao
 * volume. Para quem escreve o software fica claro; para quem chega novo, não —
 * a tela vira uma fila de botões idênticos sem hierarquia.
 *
 * Agora o turno mostra O PLANO (o que será gerado e com quais decisões) e UM
 * botão. Gerar capa/LD/separatriz não custa IA — são rotas determinísticas —,
 * então o portão de confirmação existe para o engenheiro conferir as DECISÕES,
 * não para poupar chamada de modelo.
 *
 * O volume NÃO entra aqui: ele depende destes estarem prontos e é o arquivo que
 * segue para a prefeitura, então tem confirmação própria depois da conferência.
 */

import { useState } from "react";
import { FileText, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type {
  NexoAgentProposal,
  NexoCapaProposalParams,
  NexoLdProposalParams,
} from "../types";
import { useConversation } from "../state/conversation-store";
import { gerarItem, type ItemDoPlano } from "../lib/editar-artefato";

const LABEL_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground";

/** Tipos que entram no plano; volume/auditoria/conferência têm card próprio. */
const NO_PLANO = ["capa", "ld", "separatriz"] as const;
type KindDoPlano = (typeof NO_PLANO)[number];

const NOME: Record<KindDoPlano, string> = {
  capa: "Capa",
  ld: "LD",
  separatriz: "Separatriz",
};

/**
 * Expande as propostas em itens concretos — um por tipo POR TOMO. É aqui que
 * "2 tomos" vira seis documentos, e é o número que o engenheiro precisa ver
 * antes de apertar o botão.
 */
export function itensDoPlano(proposals: NexoAgentProposal[]): ItemDoPlano[] {
  const itens: ItemDoPlano[] = [];

  for (const p of proposals) {
    if (!NO_PLANO.includes(p.kind as KindDoPlano)) continue;
    const params = p.params as Record<string, unknown>;
    const numTomos = typeof params.numTomos === "number" ? params.numTomos : 1;
    const tomoInicial =
      typeof params.tomoInicial === "number" ? params.tomoInicial : 1;

    if (numTomos <= 1) {
      itens.push({
        kind: p.kind as KindDoPlano,
        tomoAtual: 0,
        tomoNumero: tomoInicial,
        sufixo: "",
        params,
        rotulo: NOME[p.kind as KindDoPlano],
      });
      continue;
    }

    for (let i = 0; i < numTomos; i++) {
      const numero = tomoInicial + i;
      itens.push({
        kind: p.kind as KindDoPlano,
        tomoAtual: i + 1,
        tomoNumero: numero,
        sufixo: `:t${String(numero).padStart(2, "0")}`,
        params,
        rotulo: `${NOME[p.kind as KindDoPlano]} · TOMO ${String(numero).padStart(2, "0")}`,
      });
    }
  }

  return itens;
}

/** Uma linha do resumo das decisões. */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>{rotulo}</span>
      <span className="whitespace-pre-line font-mono text-sm text-foreground">
        {valor}
      </span>
    </div>
  );
}

export function PlanoDeGeracao({
  proposals,
  selos,
  templates,
  idsBase,
}: {
  proposals: NexoAgentProposal[];
  selos: SeloForLd[];
  templates: { id: string; nome: string }[];
  idsBase: { capa: string; ld: string; separatriz: string };
}) {
  const { saveResult, results } = useConversation();
  const [gerando, setGerando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const itens = itensDoPlano(proposals);
  if (itens.length === 0) return null;

  const capa = proposals.find((p) => p.kind === "capa")?.params as
    | NexoCapaProposalParams
    | undefined;
  const ld = proposals.find((p) => p.kind === "ld")?.params as
    | NexoLdProposalParams
    | undefined;

  const titulo = capa?.tituloCapa?.trim() || ld?.tituloLd?.trim() || "";
  const prefeitura =
    templates.find((t) => t.id === capa?.templateId)?.nome ??
    (capa ? "escolha a prefeitura" : "");
  const numTomos = capa?.numTomos ?? ld?.numTomos ?? 1;
  const tomoInicial = capa?.tomoInicial ?? ld?.tomoInicial ?? 1;

  const semTitulo = titulo === "";
  const semPrefeitura = Boolean(capa) && !capa?.templateId?.trim();

  // Já gerados: o card não some depois, ele muda de estado.
  const jaGerados = itens.filter((it) =>
    results.some(
      (r) =>
        r.artifactId ===
        (it.kind === "capa"
          ? idsBase.capa
          : it.kind === "ld"
            ? idsBase.ld
            : idsBase.separatriz) + it.sufixo,
    ),
  ).length;
  const tudoGerado = jaGerados === itens.length;

  async function gerarTudo() {
    setErro(null);
    try {
      for (let i = 0; i < itens.length; i++) {
        setGerando(i);
        await gerarItem({
          item: itens[i],
          selos,
          saveResult,
          idsBase,
          // A separatriz herda o título da capa — nunca deriva o seu.
          tituloDaSeparatriz: titulo,
        });
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar.");
    } finally {
      setGerando(null);
    }
  }

  const ocupado = gerando !== null;

  return (
    <div className="nexodoc-enter rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className={LABEL_CLASS}>
          {tudoGerado ? "Gerado" : "Vou gerar"} · {itens.length} documento
          {itens.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Linha
            rotulo="Título"
            valor={semTitulo ? "diga qual título →" : titulo}
          />
          {capa && <Linha rotulo="Prefeitura" valor={prefeitura} />}
          {capa && (
            <Linha
              rotulo="Volume"
              valor={capa.volume?.trim() || "auto (do arquivo)"}
            />
          )}
          <Linha
            rotulo="Tomos"
            valor={
              numTomos > 1
                ? `${numTomos} (TOMO ${String(tomoInicial).padStart(2, "0")}–${String(
                    tomoInicial + numTomos - 1,
                  ).padStart(2, "0")})`
                : "1"
            }
          />
          <Linha rotulo="Folhas" valor={`${selos.length}`} />
        </div>

        {/* A lista do que sai. Com tomos, é o que torna visível que "2 tomos"
            significa seis documentos, e não dois. */}
        <ul className="space-y-0.5">
          {itens.map((it, i) => {
            const feito = i < (gerando ?? (tudoGerado ? itens.length : jaGerados));
            return (
              <li
                key={`${it.kind}${it.sufixo}`}
                className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
              >
                {gerando === i ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : feito ? (
                  <Check className="h-3 w-3 text-[var(--status-ok)]" aria-hidden />
                ) : (
                  <span className="h-3 w-3" aria-hidden />
                )}
                {it.rotulo}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={gerarTudo}
            disabled={ocupado || semTitulo || semPrefeitura}
          >
            {ocupado ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            {ocupado
              ? `Gerando ${(gerando ?? 0) + 1} de ${itens.length}…`
              : tudoGerado
                ? "Gerar de novo"
                : `Gerar os ${itens.length}`}
          </Button>
          {(semTitulo || semPrefeitura) && (
            <span className="text-xs text-muted-foreground">
              {semTitulo
                ? "Falta o título — diga qual pela conversa."
                : "Falta a prefeitura — diga qual pela conversa."}
            </span>
          )}
        </div>

        {tudoGerado && !ocupado && (
          <p className="text-xs text-muted-foreground">
            Prontos no canvas. Selecione um documento lá para conferir ou editar.
          </p>
        )}

        {erro && (
          <p role="alert" className="text-xs text-destructive">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
