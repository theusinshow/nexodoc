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
  LdPreviewData,
  NexoAgentProposal,
  NexoCapaProposalParams,
  NexoLdProposalParams,
  NexoSeparatrizProposalParams,
} from "../types";
import { BlocoDaLd } from "./BlocoDaLd";
import { useConversation } from "../state/conversation-store";
import { gerarItem, opcoesDoTomo, type ItemDoPlano } from "../lib/editar-artefato";
import {
  blocosDasFolhas,
  misturaDisciplinas,
  resumoDosBlocos,
  type Bloco,
} from "../lib/blocos";
import { codigoDaFolha, rotuloDoCodigo } from "../lib/disciplina-da-folha";
import { summarizeSelos } from "../lib/agent-context";
import { MESES_PT } from "@/server/nexo/agent/requirements";
import type { Folha } from "../lib/folhas";
import { FrameDoDocumento } from "./FrameDoDocumento";
import {
  CAMPOS_DO_FRAME,
  separarParaGerar,
  valoresDoFrame,
} from "../lib/campos-do-frame";
import { mesclarDecisoes } from "../lib/decisoes";
import type { ParagrafoDoModelo } from "@/server/odt/layout";

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

/**
 * Um número do VOLUME — quantos tomos, a partir de qual.
 *
 * Não sai impresso na capa (o tomo daquele documento sai; a divisão, não), por
 * isso não é campo do frame. Mas é decisão, e estava só como texto: mudar a
 * divisão obrigava a pedir pelo chat.
 */
function CampoDoVolume({
  rotulo,
  valor,
  onChange,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  ajuda: string;
}) {
  return (
    <label className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {rotulo}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] text-muted-foreground/70">{ajuda}</span>
        <input
          value={valor}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="w-12 rounded-sm border border-dashed border-border bg-transparent px-1.5 py-0.5 text-right font-mono text-[11px] outline-none focus:border-solid focus:border-[var(--ring)]"
        />
      </span>
    </label>
  );
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
  ldPreview,
}: {
  proposals: NexoAgentProposal[];
  selos: SeloForLd[];
  /**
   * A prévia determinística das folhas, que o servidor manda a cada turno.
   * Estava órfã: quem a desenhava deixou de receber propostas de LD quando
   * este card assumiu o caminho de capa/LD/separatriz.
   */
  ldPreview?: LdPreviewData;
  /** `layout` é a estrutura do modelo ODT — é dela que o frame se desenha. */
  templates: { id: string; nome: string; layout?: ParagrafoDoModelo[] }[];
  idsBase: { capa: string; ld: string; separatriz: string };
}) {
  const {
    saveResult,
    results,
    totaisPorDisciplina,
    identidade,
    corrigirIdentidade,
    decisoes,
    decidir,
    guardarDecisoesVivas,
  } = useConversation();
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

  const capaCrua = proposals.find((p) => p.kind === "capa")?.params as
    | NexoCapaProposalParams
    | undefined;
  const ldCrua = proposals.find((p) => p.kind === "ld")?.params as
    | NexoLdProposalParams
    | undefined;

  /*
   * O QUE O AGENTE PROPÔS NESTE TURNO, e o que vale DEPOIS das decisões do
   * engenheiro. A mescla guarda junto o valor do agente que cada decisão
   * substituiu — é isso que faz a edição sobreviver ao próximo turno do chat
   * sem impedir que ele mude de ideia. Ver [[decisoes.ts]].
   */
  const paramsDoAgente: Record<string, string> = {
    templateId: capaCrua?.templateId ?? "",
    tituloCapa: capaCrua?.tituloCapa ?? "",
    tituloLd: ldCrua?.tituloLd ?? "",
    volume: capaCrua?.volume ?? "",
    mes: capaCrua?.mes ?? "",
    ano: capaCrua?.ano ?? "",
    numTomos: String(capaCrua?.numTomos ?? ldCrua?.numTomos ?? 1),
    tomoInicial: String(capaCrua?.tomoInicial ?? ldCrua?.tomoInicial ?? 1),
  };
  const mesclado = mesclarDecisoes(decisoes, paramsDoAgente);

  const inteiro = (v: string | undefined, padrao: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : padrao;
  };

  /*
   * As propostas COM as decisões aplicadas. A mescla precisa acontecer aqui, e
   * não só na hora de gerar, porque `numTomos` decide QUANTOS documentos o card
   * lista — trocar 6 tomos por 4 tem de mudar a lista na hora, não só o PDF.
   */
  const propostas: NexoAgentProposal[] = proposals.map((p) => {
    if (p.kind === "capa") {
      return {
        ...p,
        params: {
          ...p.params,
          templateId: mesclado.valores.templateId ?? "",
          tituloCapa: mesclado.valores.tituloCapa ?? "",
          volume: mesclado.valores.volume ?? "",
          mes: mesclado.valores.mes ?? "",
          ano: mesclado.valores.ano ?? "",
          numTomos: inteiro(mesclado.valores.numTomos, 1),
          tomoInicial: inteiro(mesclado.valores.tomoInicial, 1),
        },
      };
    }
    if (p.kind === "ld") {
      return {
        ...p,
        params: {
          ...p.params,
          tituloLd: mesclado.valores.tituloLd ?? "",
          numTomos: inteiro(mesclado.valores.numTomos, 1),
          tomoInicial: inteiro(mesclado.valores.tomoInicial, 1),
        },
      };
    }
    if (p.kind === "separatriz") {
      return {
        ...p,
        params: { ...p.params, numTomos: inteiro(mesclado.valores.numTomos, 1) },
      };
    }
    return p;
  });

  const itens = itensDoPlano(propostas, blocos, selos);
  if (itens.length === 0) return null;

  const capa = propostas.find((p) => p.kind === "capa")?.params as
    | NexoCapaProposalParams
    | undefined;
  const ld = propostas.find((p) => p.kind === "ld")?.params as
    | NexoLdProposalParams
    | undefined;

  const titulo = capa?.tituloCapa?.trim() || ld?.tituloLd?.trim() || "";
  const prefeitura =
    templates.find((t) => t.id === capa?.templateId)?.nome ??
    (capa ? "escolha a prefeitura" : "");
  const numTomos = capa?.numTomos ?? ld?.numTomos ?? 1;
  const tomoInicial = capa?.tomoInicial ?? ld?.tomoInicial ?? 1;

  /*
   * A IDENTIDADE DO PROJETO no resumo. Antes o card mostrava título, prefeitura,
   * volume, tomos e folhas — e faltava justamente o que responde "é o projeto
   * certo?": a obra, o código e a data que vai impressa. O engenheiro só via
   * esses três abrindo o PDF, que é tarde demais para descobrir que a data está
   * errada em seis capas.
   *
   * O que foi corrigido à mão (`identidade`) vem primeiro; senão vale o carimbo.
   */
  const doSelo = summarizeSelos(selos);
  const obra = identidade.obra?.trim() || doSelo.obra || "";
  const codigo = identidade.codigo?.trim() || doSelo.codigo || "";
  const revisao = identidade.revisao?.trim() || doSelo.revisao || "";
  const dataDaCapa = (() => {
    const mes = capa?.mes?.trim();
    const ano = capa?.ano?.trim();
    if (!mes && !ano) return "";
    const n = Number(mes);
    const nome = Number.isFinite(n) && n >= 1 && n <= 12 ? MESES_PT[n - 1] : mes;
    return [nome, ano].filter(Boolean).join("/");
  })();

  /*
   * Num volume misto sem capa no plano, o título global não é decisão nenhuma:
   * cada LD e cada separatriz recebe o nome da SUA disciplina. Exigi-lo ali
   * travaria o botão pedindo um dado que não vai a lugar nenhum. A capa, essa
   * sim, continua precisando — o título dela é o do volume inteiro.
   */
  /*
   * A LISTA de disciplinas ditada na conversa JÁ É o título — de cada folha.
   * Sem esta exceção, pedir "as separatrizes de elétrica, CFTV e SPDA" travava o
   * botão pedindo "diga qual título", que o engenheiro acabara de dizer três
   * vezes. Era o defeito que mantinha a tela `/separatrizes` viva na prática.
   */
  const titulosDaSeparatriz = (
    (proposals.find((p) => p.kind === "separatriz")?.params as
      | NexoSeparatrizProposalParams
      | undefined)?.titulos ?? []
  )
    .map((t) => t.trim())
    .filter(Boolean);
  const separatrizListada = titulosDaSeparatriz.length > 0;
  const semTitulo = titulo === "" && (Boolean(capa) || !misto) && !separatrizListada;
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
  /** A estrutura do modelo da prefeitura escolhida. Vazia = sem frame. */
  const layoutDoModelo =
    templates.find((t) => t.id === mesclado.valores.templateId)?.layout ?? [];

  /*
   * Os marcadores que o engenheiro acrescentou ao modelo e o Nexo não conhece.
   * Ficam guardados como decisão (é onde o frame os põe) e só os que o modelo
   * REALMENTE desenha são enviados — uma decisão órfã de um modelo antigo não
   * pode virar substituição num modelo novo.
   */
  const marcadoresDoModelo = new Set(
    layoutDoModelo
      .flatMap((p) => p.partes)
      .flatMap((x) => (x.tipo === "marcador" ? [x.nome] : [])),
  );
  const extras: Record<string, string> = {};
  for (const [campo, d] of Object.entries(decisoes)) {
    if (marcadoresDoModelo.has(campo) && d.valor) extras[campo] = d.valor;
  }

  /*
   * Editar no frame é DECIDIR, e cada campo vai para o seu dono: identidade
   * para a conversa (regra própria — vazio significa "vale o carimbo"), o resto
   * para as decisões, que guardam junto o que o agente propunha. Misturá-los
   * faria a correção da obra durar só até a próxima geração pelo plano.
   */
  function aoEditarNoFrame(marcador: string, valor: string) {
    const { identidade: ident, params, extras } = separarParaGerar({
      [marcador]: valor,
    });
    if (Object.keys(ident).length > 0) corrigirIdentidade(ident);
    for (const [campo, v] of Object.entries(params)) {
      decidir(campo, v, paramsDoAgente[campo] ?? "");
    }
    // Marcador que o modelo tem e o Nexo não conhece: guardado como decisão,
    // e entregue à geração pelo canal de extras.
    for (const [campo, v] of Object.entries(extras)) decidir(campo, v, "");
  }

  async function gerarTudo() {
    // As decisões que sobreviveram a este turno. Sem guardar de volta, uma que
    // perdeu para o agente voltaria a vencer quando ele repetisse o valor novo.
    guardarDecisoesVivas(mesclado.vivas);
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
            // Os marcadores que o engenheiro acrescentou ao modelo. Sem eles,
            // o campo que o frame ofereceu sairia literal no documento.
            extras,
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
        {/*
         * PARA QUEM VAI. A prefeitura estava numa linha igual às outras, e é o
         * único campo aqui cujo erro custa o projeto inteiro — foi um volume
         * enviado com o brasão de outra prefeitura que originou este produto.
         * Ela sai da lista e ganha peso próprio, no topo, antes de qualquer
         * parâmetro.
         */}
        {capa && (
          <div className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-[var(--nexodoc-recessed)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              Vai para
            </span>
            {/*
             * Sem prefeitura escolhida não há modelo, e sem modelo não há frame.
             * O seletor entra AQUI, no mesmo lugar onde a resposta aparece —
             * mandar escolher pela conversa foi o que fez o engenheiro não achar
             * a decisão da última vez.
             */}
            {semPrefeitura ? (
              <select
                aria-label="Prefeitura"
                value=""
                onChange={(e) => decidir("templateId", e.target.value, "")}
                className="rounded-sm border border-[var(--status-warning)]/40 bg-transparent px-2 py-1 text-sm text-[var(--status-warning)] outline-none"
              >
                <option value="">escolha a prefeitura</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-right text-sm font-medium leading-snug text-foreground">
                {prefeitura}
              </span>
            )}
          </div>
        )}

        {/*
         * O CARD É O DOCUMENTO.
         *
         * Aqui havia uma lista de rótulo/valor que terminava em "Falta o título
         * — diga qual pela conversa": o produto mandava escrever num chat um
         * campo que podia estar ali, na forma em que vai sair impresso. O frame
         * se desenha a partir do modelo ODT, então editar o modelo basta.
         *
         * Modelo ilegível (ou prefeitura ainda não escolhida) cai na lista de
         * sempre — degradar é melhor que sumir.
         */}
        {layoutDoModelo.length > 0 ? (
          <FrameDoDocumento
            layout={layoutDoModelo}
            campos={CAMPOS_DO_FRAME}
            valores={valoresDoFrame({
              identidade,
              derivados: {
                NOME_OBRA: obra,
                CODIGO_EXIBIDO: codigo,
                MES_ANO: dataDaCapa || "mês corrente",
                VOLUME: capa?.volume?.trim() || "do arquivo",
                TOMO:
                  numTomos > 1
                    ? `TOMO ${String(tomoInicial).padStart(2, "0")}…`
                    : "",
                DISCIPLINA: misto ? resumoDosBlocos(blocos) : "",
              },
              params: mesclado.valores,
            })}
            onChange={aoEditarNoFrame}
          />
        ) : null}

        {/*
         * A LD, EMPILHADA — nada atrás de aba. Num volume misto é uma por
         * disciplina, e o título de cada uma é o da SUA disciplina (herdado,
         * não digitado): mostrar um campo editável ali seria oferecer uma
         * decisão que a geração ignora.
         */}
        {proposals.some((p) => p.kind === "ld") &&
          (misto
            ? blocos
                .filter((b) => b.codigo)
                .map((b) => (
                  <BlocoDaLd
                    key={b.codigo}
                    titulo={(b.rotulo || "Sem disciplina").toUpperCase()}
                    onTitulo={() => {}}
                    somenteLeitura
                    codigo={codigo}
                    revisao={revisao}
                    totalFolhas={b.ids.length}
                  />
                ))
            : (
                <BlocoDaLd
                  titulo={mesclado.valores.tituloLd ?? ""}
                  onTitulo={(v) => decidir("tituloLd", v, paramsDoAgente.tituloLd)}
                  codigo={codigo}
                  revisao={revisao}
                  preview={ldPreview}
                  totalFolhas={selos.length}
                />
              ))}

        {/*
         * O QUE O FRAME NÃO DESENHA porque não sai impresso na capa: a divisão
         * em tomos e o tamanho do conjunto. São decisões sobre o VOLUME, não
         * sobre o documento — por isso ficam abaixo dele, e não dentro.
         */}
        <div className="space-y-1.5">
          {/* Sem modelo não há frame: o título volta a ser linha, para não
              sumir junto. */}
          {layoutDoModelo.length === 0 && (capa || !misto) && !separatrizListada && (
            <Linha rotulo="Título" valor={titulo || "—"} />
          )}
          {layoutDoModelo.length === 0 && obra && <Linha rotulo="Obra" valor={obra} />}
          {layoutDoModelo.length === 0 && codigo && (
            <Linha rotulo="Código" valor={codigo} />
          )}
          {/* A lista ditada é o que sai impresso: uma folha por item, nesta
              ordem. É o que o engenheiro confere antes de gerar. */}
          {separatrizListada && (
            <Linha
              rotulo={`Disciplinas (${titulosDaSeparatriz.length} folhas)`}
              valor={titulosDaSeparatriz.join(" · ")}
            />
          )}
          <CampoDoVolume
            rotulo="Nº de tomos"
            valor={String(numTomos)}
            onChange={(v) => decidir("numTomos", v, paramsDoAgente.numTomos)}
            ajuda={
              numTomos > 1
                ? `TOMO ${String(tomoInicial).padStart(2, "0")}–${String(
                    tomoInicial + numTomos - 1,
                  ).padStart(2, "0")}`
                : "documento único"
            }
          />
          {numTomos > 1 && (
            <CampoDoVolume
              rotulo="Tomo inicial"
              valor={String(tomoInicial)}
              onChange={(v) => decidir("tomoInicial", v, paramsDoAgente.tomoInicial)}
              ajuda="de onde a contagem começa neste volume"
            />
          )}
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
          {/*
           * Antes aqui dizia "diga qual pela conversa" — mandando escrever num
           * chat um campo que agora está no card, aceso, na forma em que sai
           * impresso. A frase aponta para o campo, não para outro lugar.
           */}
          {(semTitulo || semPrefeitura) && (
            <span className="text-xs text-muted-foreground">
              {semPrefeitura
                ? "Escolha a prefeitura acima."
                : "Falta o título — preencha no documento acima."}
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
