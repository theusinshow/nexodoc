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
import { gerarItem, opcoesDoTomo, type ItemDoPlano } from "../lib/editar-artefato";
import {
  blocosDasFolhas,
  misturaDisciplinas,
  resumoDosBlocos,
  type Bloco,
} from "../lib/blocos";
import { codigoDaFolha, rotuloDoCodigo } from "../lib/disciplina-da-folha";
import type { Folha } from "../lib/folhas";

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
 * Expande as propostas em itens concretos — um por tipo, POR TOMO e POR BLOCO.
 *
 * É aqui que "2 tomos" vira seis documentos, e é o número que o engenheiro
 * precisa ver antes de apertar o botão. É aqui, também, que o volume de várias
 * disciplinas deixa de sair errado: a proposta traz UMA LD (com a disciplina
 * majoritária), e o escritório entrega uma LD e uma separatriz POR DISCIPLINA
 * — o volume 10 de 040-26 tem três de cada, sob uma capa só.
 *
 * A capa não se multiplica por bloco: é uma por volume físico, e é ela que
 * anuncia as disciplinas que vêm dentro.
 *
 * `blocos` vazio ou com um só = volume de disciplina única, e nada muda.
 */
export function itensDoPlano(
  proposals: NexoAgentProposal[],
  blocos: readonly Bloco[] = [],
  selos: SeloForLd[] = [],
): ItemDoPlano[] {
  const itens: ItemDoPlano[] = [];
  const porBloco = misturaDisciplinas(blocos);

  for (const p of proposals) {
    if (!NO_PLANO.includes(p.kind as KindDoPlano)) continue;
    const kind = p.kind as KindDoPlano;
    const params = p.params as Record<string, unknown>;
    const numTomos = typeof params.numTomos === "number" ? params.numTomos : 1;
    const tomoInicial =
      typeof params.tomoInicial === "number" ? params.tomoInicial : 1;

    // A capa é do volume; a LD e a separatriz são do bloco.
    const doTipo: (Bloco | undefined)[] =
      porBloco && kind !== "capa" ? [...blocos] : [undefined];

    for (let i = 0; i < Math.max(1, numTomos); i++) {
      const temTomo = numTomos > 1;
      const numero = tomoInicial + i;
      const sufixoTomo = temTomo ? `:t${String(numero).padStart(2, "0")}` : "";
      const tomoAtual = temTomo ? i + 1 : 0;
      // As folhas deste tomo, para não anunciar o bloco que não tem nenhuma
      // dentro dele — um item que não produz documento é uma linha mentirosa.
      const doTomo = temTomo
        ? new Set(opcoesDoTomo(selos, numTomos, tomoAtual).doTomo.map((f) => f.id))
        : null;

      for (const bloco of doTipo) {
        if (bloco && doTomo && !bloco.ids.some((id) => doTomo.has(id))) continue;
        const sufixoBloco = bloco ? `:${bloco.codigo || "sem"}` : "";
        const nomeBloco = bloco ? ` · ${bloco.rotulo || "Sem disciplina"}` : "";
        itens.push({
          kind,
          tomoAtual,
          tomoNumero: numero,
          sufixo: sufixoBloco + sufixoTomo,
          params,
          rotulo: `${NOME[kind]}${nomeBloco}${
            temTomo ? ` · TOMO ${String(numero).padStart(2, "0")}` : ""
          }`,
          ...(bloco ? { bloco } : {}),
        });
      }
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
  const { saveResult, results, totaisPorDisciplina, identidade } = useConversation();
  const [gerando, setGerando] = useState<number | null>(null);
  /** O que falhou na última tentativa. Vazio = nada falhou. */
  const [falhas, setFalhas] = useState<{ rotulo: string; motivo: string }[]>([]);

  /*
   * OS BLOCOS DO VOLUME. A proposta do agente traz UMA LD, com a disciplina
   * majoritária das pranchas; o escritório entrega uma LD e uma separatriz por
   * disciplina. Sem isto, as folhas das outras disciplinas saíam sob um título
   * que não é o delas — e o PDF ia embora assim, sem aviso.
   */
  const blocos = blocosDasFolhas(selos as Folha[], codigoDaFolha, rotuloDoCodigo);
  const misto = misturaDisciplinas(blocos);

  const itens = itensDoPlano(proposals, blocos, selos);
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

  /*
   * Num volume misto sem capa no plano, o título global não é decisão nenhuma:
   * cada LD e cada separatriz recebe o nome da SUA disciplina. Exigi-lo ali
   * travaria o botão pedindo um dado que não vai a lugar nenhum. A capa, essa
   * sim, continua precisando — o título dela é o do volume inteiro.
   */
  const semTitulo = titulo === "" && (Boolean(capa) || !misto);
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

  /*
   * UMA falha não derruba as outras.
   *
   * Antes, o `try` envolvia o laço inteiro: o modelo de uma prefeitura não
   * responder no terceiro documento abortava o quarto, que não tinha nada a ver
   * com isso. E a mensagem dizia só "erro ao gerar" — o engenheiro não sabia se
   * tinha zero ou três arquivos na mão, então refazia tudo.
   *
   * Agora cada item é tentado, as falhas são colecionadas, e no fim o card diz
   * o que falhou E o que sobreviveu.
   */
  async function gerarTudo() {
    setFalhas([]);
    const coletadas: { rotulo: string; motivo: string }[] = [];
    try {
      for (let i = 0; i < itens.length; i++) {
        setGerando(i);
        try {
          await gerarItem({
            item: itens[i],
            selos,
            saveResult,
            idsBase,
            // A separatriz herda o título da capa — nunca deriva o seu.
            tituloDaSeparatriz: titulo,
            // O total corrigido à mão: este é o caminho NORMAL de gerar, então
            // é por aqui que a correção precisa chegar ao documento.
            totais: totaisPorDisciplina,
            // O escape de quando o carimbo mente. Pelo mesmo motivo do total:
            // este é o caminho normal de gerar.
            identidade,
          });
        } catch (err) {
          coletadas.push({
            rotulo: itens[i].rotulo,
            motivo: err instanceof Error ? err.message : "erro desconhecido",
          });
        }
      }
    } finally {
      setGerando(null);
      setFalhas(coletadas);
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
          {/*
            O título só aparece quando é DECISÃO. No volume misto sem capa,
            cada LD e cada separatriz leva o nome da sua disciplina, e mostrar
            um título global aqui faria o engenheiro conferir um campo que não
            sai em documento nenhum.
          */}
          {(capa || !misto) && (
            <Linha
              rotulo="Título"
              valor={semTitulo ? "diga qual título →" : titulo}
            />
          )}
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
          {misto && <Linha rotulo="Disciplinas" valor={resumoDosBlocos(blocos)} />}
        </div>

        {/*
          Por que são N documentos e não um. O engenheiro pediu "a LD" e vai
          receber três — sem a frase, o número parece defeito.
        */}
        {misto && (
          <p className="text-xs leading-5 text-muted-foreground">
            As pranchas são de {blocos.filter((b) => b.codigo).length} disciplinas.
            O volume leva uma capa e, depois dela, um bloco por disciplina — por
            isso sai uma separatriz e uma LD para cada, como o escritório
            entrega. O título de cada uma é o da sua disciplina.
          </p>
        )}

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

        {/*
          A regra: falha parcial NUNCA se apresenta como falha total. Sem a
          última frase, o engenheiro refaz trabalho que já está pronto — e
          refazer é o que mais custa tempo neste fluxo.
        */}
        {falhas.length > 0 && !ocupado && (
          <div
            role="alert"
            className="rounded-md border border-[var(--status-critical)]/35 bg-[var(--status-critical-bg)] p-3"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-[var(--status-critical)]">
              {falhas.length === 1
                ? `${falhas[0].rotulo} não foi gerada`
                : `${falhas.length} documentos não foram gerados`}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {falhas.map((f) => (
                <li key={f.rotulo} className="text-xs leading-5 text-foreground">
                  <span className="font-mono">{f.rotulo}</span> — {f.motivo}
                </li>
              ))}
            </ul>
            {itens.length - falhas.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-[var(--status-ok)]">
                {itens.length - falhas.length === 1
                  ? "O outro documento saiu normalmente."
                  : `Os outros ${itens.length - falhas.length} documentos saíram normalmente.`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
