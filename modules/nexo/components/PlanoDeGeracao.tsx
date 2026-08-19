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

import { useMemo, useState } from "react";
import { FileText, Loader2, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import { Select } from "@/components/ui/select";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type {
  LdPreviewData,
  NexoAgentProposal,
  NexoCapaProposalParams,
  NexoLdProposalParams,
  NexoSeparatrizProposalParams,
} from "../types";
import { BlocoDaLd } from "./BlocoDaLd";
import { ResultLinks } from "./ResultLinks";
import { useConversation } from "../state/conversation-store";
import {
  gerarItem,
  opcoesDoTomo,
  payloadDoItem,
  type ItemDoPlano,
} from "../lib/editar-artefato";
import { estadoDoArtefato } from "../lib/estado-do-artefato";
import {
  blocoGera,
  blocosDasFolhas,
  misturaDisciplinas,
  resumoDosBlocos,
  type Bloco,
} from "../lib/blocos";
import { codigoDaFolha, rotuloDoCodigo } from "../lib/disciplina-da-folha";
import { titulosPropostos, tituloDoSelo } from "../lib/titulo-do-selo";
import { conferirPrefeitura } from "../lib/coerencia-do-volume";
import { nomeNaCapa, nomeNoDocumento } from "@/server/nexo/disciplinas";
import { dataDominante } from "@/server/nexo/data-do-selo";
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
import { textoEmLinhasDaCapa } from "@/server/nexo/capa-linhas";
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
 *
 * E O QUE A DISCIPLINA NÃO ENTREGA NÃO ENTRA (`blocoGera`): sondagem não tem LD
 * na tabela do escritório, então o bloco de sondagem anuncia separatriz e
 * pranchas e nenhuma LD. Quem monta lê a mesma tabela em
 * `motivoParaNaoMontar` — se só um dos dois lesse, o volume de sondagem ficaria
 * travado pedindo um documento que o plano não oferece mais.
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
        // A tabela do escritório manda: sondagem não tem LD, e o item que não
        // vira documento não pode aparecer no plano. `capa` nunca passa por
        // aqui com bloco — ela é uma por volume físico.
        if (kind !== "capa" && !blocoGera(kind, bloco)) continue;
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
   * A separatriz crua entra aqui porque ela TAMBÉM imprime a prefeitura, e num
   * plano sem capa ela é a única que a tem. Sem isto, `templateId` do agente
   * ficava vazio nesse caso e a decisão do engenheiro não tinha de onde partir.
   */
  const sepCrua = proposals.find((p) => p.kind === "separatriz")?.params as
    | { templateId?: string }
    | undefined;

  /*
   * O QUE O AGENTE PROPÔS NESTE TURNO, e o que vale DEPOIS das decisões do
   * engenheiro. A mescla guarda junto o valor do agente que cada decisão
   * substituiu — é isso que faz a edição sobreviver ao próximo turno do chat
   * sem impedir que ele mude de ideia. Ver [[decisoes.ts]].
   */
  /*
   * O TÍTULO QUE O CARIMBO JÁ SABE.
   *
   * O campo OBRA do selo é o nome do empreendimento. Ele já é lido em toda
   * prancha, e mesmo assim o engenheiro digitava no chat uma informação que o
   * próprio documento trazia.
   *
   * Ele nomeia a CAPA, e SÓ a capa: o título da LD é o nome de documento da
   * disciplina, e quem responde por ele é o léxico. Ver `titulosPropostos`, que
   * é onde essa separação mora e onde ela é testada.
   *
   * Entra como degrau ABAIXO do agente: se o agente propôs um título (porque foi
   * pedido na conversa), ele vence; e as decisões do engenheiro vencem os dois,
   * porque `mesclarDecisoes` roda depois. Carimbos que discordam não preenchem —
   * `tituloDoSelo` devolve vazio no empate, e vazio vira pergunta.
   */
  const tituloDoCarimbo = useMemo(() => tituloDoSelo(selos), [selos]);

  const paramsDoAgente: Record<string, string> = {
    templateId: capaCrua?.templateId?.trim() || sepCrua?.templateId?.trim() || "",
    ...titulosPropostos({ capa: capaCrua?.tituloCapa, ld: ldCrua?.tituloLd }, tituloDoCarimbo),
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
        params: {
          ...p.params,
          /*
           * A DECISÃO DO ENGENHEIRO PRECISA CHEGAR AQUI.
           *
           * Só o ramo da capa consumia `mesclado.valores.templateId`: quem
           * escolhia a prefeitura no seletor mudava a capa e deixava a
           * separatriz com o que o agente tinha proposto. Um volume com capa de
           * Criciúma e separatriz de Chapecó saía assim, com a escolha certa
           * feita e ignorada pela metade do plano.
           */
          templateId: mesclado.valores.templateId ?? "",
          numTomos: inteiro(mesclado.valores.numTomos, 1),
        },
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

  /*
   * O título em uso VEIO do carimbo (ninguém o pediu nem digitou)?
   *
   * Preenchimento automático que não se anuncia é pior que campo vazio: vai para
   * a capa impressa sem ninguém ter olhado. A nota diz de onde veio e com quanto
   * apoio, e a divergência aparece junto — é o mesmo tratamento que a data já
   * recebe logo abaixo.
   */
  const tituloVeioDoCarimbo =
    tituloDoCarimbo.valor !== "" &&
    titulo === tituloDoCarimbo.valor &&
    !capaCrua?.tituloCapa?.trim() &&
    !ldCrua?.tituloLd?.trim();
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
  /*
   * O TÍTULO SUGERIDO, do léxico de disciplinas.
   *
   * A disciplina de cada folha sai do nome do arquivo e do carimbo, e o nome
   * padrão de cada uma é fonte única desde [[disciplinas.ts]] — então o título
   * da capa deixou de ser uma pergunta sem resposta e virou fato derivado com
   * override, como a obra e o código.
   *
   * UMA LINHA POR DISCIPLINA, que é como as capas reais de volume misto são
   * escritas (116-25: urbanização / paisagismo / maquete). Num volume de uma
   * disciplina só, sai uma linha.
   */
  const tituloSugerido = blocos
    .filter((b) => b.codigo)
    .map((b) => nomeNaCapa(b.codigo) ?? b.rotulo.toUpperCase())
    .filter(Boolean)
    .join("\n");

  const doSelo = summarizeSelos(selos);
  const obra = identidade.obra?.trim() || doSelo.obra || "";
  const codigo = identidade.codigo?.trim() || doSelo.codigo || "";
  const revisao = identidade.revisao?.trim() || doSelo.revisao || "";
  /*
   * QUANTAS FOLHAS DISCORDAM da data que vai sair impressa.
   *
   * O preço de afirmar em vez de perguntar: a data agora vem do carimbo
   * dominante, e sem esta marca a prancha intrusa — de outro mês, de outro
   * projeto — entraria no volume sem ninguém ver. Aparece no FANTASMA do campo,
   * onde a data já está sendo conferida, e não num painel à parte que ninguém
   * abre.
   */
  const divergenciaDaData = dataDominante(selos.map((s) => s.data))?.divergentes ?? 0;
  const dataDaCapa = (() => {
    const mes = capa?.mes?.trim();
    const ano = capa?.ano?.trim();
    if (!mes && !ano) return "";
    const n = Number(mes);
    const nome = Number.isFinite(n) && n >= 1 && n <= 12 ? MESES_PT[n - 1] : mes;
    const base = [nome, ano].filter(Boolean).join("/");
    return divergenciaDaData > 0
      ? `${base} · ${plural(divergenciaDaData, "folha com outra data", "folhas com outra data")}`
      : base;
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
  /*
   * Falta título só quando NÃO HÁ COMO SABER.
   *
   * Antes, título vazio travava o botão e mandava responder pela conversa. Com
   * o léxico de disciplinas, um volume cuja disciplina foi lida JÁ TEM nome —
   * o construtor cai nele sozinho. Travar aí seria pedir uma decisão que o
   * sistema já tomou, e é decisão que o engenheiro só confirmaria.
   */
  const semTitulo =
    titulo === "" &&
    tituloSugerido === "" &&
    (Boolean(capa) || !misto) &&
    !separatrizListada;
  /*
   * O PORTÃO DA PREFEITURA — todos os documentos que a imprimem, não só a capa.
   *
   * Isto era `Boolean(capa) && !capa?.templateId?.trim()`, e tinha dois furos
   * do mesmo tamanho: um plano SEM capa (só separatriz) nunca travava, e uma
   * separatriz que discordasse da capa passava sem uma palavra. Os dois
   * terminam no mesmo lugar — um volume emitido para o município errado.
   *
   * `normalizeProposals` já impede que documentos divergentes nasçam; este
   * portão pega o que a construção não alcança, que é a prefeitura editada
   * depois. Ver [[coerencia-do-volume.ts]].
   */
  const problemaDePrefeitura = conferirPrefeitura(
    propostas
      .filter((p) => p.kind === "capa" || p.kind === "separatriz")
      .map((p) => ({
        rotulo: p.kind === "capa" ? "Capa" : "Separatriz",
        templateId: String((p.params as { templateId?: unknown })?.templateId ?? ""),
      })),
  );
  const semPrefeitura = problemaDePrefeitura?.tipo === "vazia";

  /*
   * O ESTADO DE CADA ITEM — não a contagem de ids existentes.
   *
   * Aqui só se perguntava se o `artifactId` já estava em `results`. Como o id é
   * ESTÁVEL de propósito (uma capa por conversa, atualizada no lugar), mudar o
   * título, a prefeitura ou a data depois de gerar mantinha o card dizendo
   * "Gerado", com os checks verdes, enquanto o PDF no canvas envelhecia. O
   * volume seguia para a prefeitura com o documento errado e nada na tela
   * avisava. A DESIGN.md § "Estados das ações do Nexo" chama isso de o erro
   * mais caro desta tela.
   *
   * `estadoDoArtefato` compara o payload que ORIGINOU o resultado com o de
   * agora, e `payloadDoItem` é a MESMA função que a geração usa para gravar —
   * duas formas de montar o payload fariam todo artefato nascer pendente.
   */
  /*
   * O resultado salvo de cada item, guardado (e não descartado como antes): é
   * dele que saem os DOWNLOADS. O ODT já estava no IndexedDB desde sempre — o
   * gerador da LD produz ODT primeiro e deriva o PDF dele —, mas este card não
   * oferecia arquivo nenhum, e o único caminho até o editável passava por
   * montar um volume. Nada aqui gera: só desenha o que já existe.
   */
  const salvosDosItens = itens.map((it) => {
    const artifactId =
      (it.kind === "capa"
        ? idsBase.capa
        : it.kind === "ld"
          ? idsBase.ld
          : idsBase.separatriz) + it.sufixo;
    return results.find((r) => r.artifactId === artifactId);
  });
  const estados = itens.map((it, i) =>
    estadoDoArtefato(
      salvosDosItens[i],
      payloadDoItem({ item: it, selos, tituloDaSeparatriz: titulo }),
    ),
  );
  const jaGerados = estados.filter((e) => e === "aplicado").length;
  const pendentes = estados.filter((e) => e === "pendente").length;
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

  const bordaPlano =
    pendentes > 0
      ? "border-[var(--status-warning)]/45"
      : tudoGerado
        ? "border-[var(--status-ok)]/30"
        : "border-border";

  return (
    <div
      className={`nexodoc-enter rounded-md border ${bordaPlano} bg-card transition-colors duration-[var(--duration-base)] ease-[var(--ease-feedback)]`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span
          className={
            pendentes > 0
              ? `${LABEL_CLASS} text-[var(--status-warning)]`
              : LABEL_CLASS
          }
        >
          {pendentes > 0
            ? "Alteração pendente"
            : tudoGerado
              ? "Gerado"
              : "Vou gerar"}{" "}
          · {itens.length} documento{itens.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {/*
         * O AVISO ANDA COM O RÓTULO.
         *
         * Ele nasceu no rodapé, ao lado do botão. Com a prefeitura escolhida, o
         * frame do documento é alto: a captura mostrou o aviso em y=1083 numa
         * janela de 1000 — no DOM, fora da tela. Um aviso que exige rolar para
         * ser lido não avisa. Aqui ele entra logo abaixo do cabeçalho que diz
         * "Alteração pendente", que é o que o engenheiro vê primeiro.
         */}
        {pendentes > 0 && !ocupado && (
          <p className="text-xs leading-5 text-[var(--status-warning)]">
            {pendentes === 1
              ? "Um documento foi gerado antes desta alteração e ainda está com os valores antigos."
              : `${pendentes} documentos foram gerados antes desta alteração e ainda estão com os valores antigos.`}{" "}
            O que está no canvas não vale até atualizar.
          </p>
        )}

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
              <Select
                aria-label="Prefeitura"
                value=""
                onChange={(e) => decidir("templateId", e.target.value, "")}
          >
                <option value="">escolha a prefeitura</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Select>
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
            valores={valoresDoFrame({ identidade, params: mesclado.valores })}
            /*
             * O que o carimbo, o arquivo e a divisão já dizem — texto fantasma
             * nos campos editáveis, valor nos derivados. Nunca valor de campo:
             * ali ele impediria apagar.
             */
            derivados={{
              // Já quebrada nas linhas em que vai sair impressa — o carimbo
              // escreve "A - B" numa tira só, e a capa tem duas linhas.
              NOME_OBRA: textoEmLinhasDaCapa(obra),
              // O nome padrão da disciplina lida — é o que sai se ninguém
              // digitar nada, então é o que o campo deve mostrar apagado.
              TITULO_CAPA: tituloSugerido,
              CODIGO_EXIBIDO: codigo,
              MES_ANO: dataDaCapa || "mês corrente",
              VOLUME: capa?.volume?.trim() || "do arquivo",
              TOMO:
                numTomos > 1 ? `TOMO ${String(tomoInicial).padStart(2, "0")}…` : "",
              DISCIPLINA: misto ? resumoDosBlocos(blocos) : "",
            }}
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
            ? /*
               * TODOS os blocos, inclusive o "sem disciplina".
               *
               * Filtrar por `codigo` mostrava 3 LDs enquanto o plano gerava 4:
               * `itensDoPlano` percorre a lista inteira, e as folhas cuja
               * disciplina não foi lida também viram um bloco. Esconder esse
               * bloco é esconder justamente o que precisa de conferência.
               */
              blocos.map((b) => (
                <BlocoDaLd
                  key={b.codigo || "sem-disciplina"}
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
                  /* O nome de DOCUMENTO da disciplina — o que sai impresso se
                     ninguém digitar. É o longo, diferente do da capa. */
                  sugestao={
                    blocos.find((b) => b.codigo)
                      ? (nomeNoDocumento(blocos.find((b) => b.codigo)!.codigo) ?? "")
                      : ""
                  }
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
          {/* Fora do `layoutDoModelo.length === 0`: com modelo o título vive no
              frame, e a procedência tem de aparecer nos dois casos. */}
          {tituloVeioDoCarimbo && (
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Título lido do carimbo de {plural(tituloDoCarimbo.apoio, "folha", "folhas")}
              {tituloDoCarimbo.divergentes > 0
                ? ` · ${plural(tituloDoCarimbo.divergentes, "folha diz outra coisa", "folhas dizem outra coisa")}`
                : ""}
              {" — se estiver errado, corrija pelo chat."}
            </p>
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
        <ul className="space-y-1.5">
          {itens.map((it, i) => {
            /*
             * O check era POSICIONAL (`i < contagem`): com o item 0 velho e o 1
             * em dia, o verde ia para o errado. Agora cada linha diz o seu.
             */
            const estado = estados[i];
            const salvo = salvosDosItens[i];
            return (
              <li key={`${it.kind}${it.sufixo}`} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {gerando === i ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : estado === "aplicado" ? (
                    <Check className="h-3 w-3 text-[var(--status-ok)]" aria-hidden />
                  ) : estado === "pendente" ? (
                    <RefreshCw
                      className="h-3 w-3 text-[var(--status-warning)]"
                      aria-hidden
                    />
                  ) : (
                    <span className="h-3 w-3" aria-hidden />
                  )}
                  {it.rotulo}
                  {estado === "pendente" && gerando !== i && (
                    <span className="text-[var(--status-warning)]">
                      · alteração pendente
                    </span>
                  )}
                </span>
                {/*
                  OS ARQUIVOS, ONDE O ENGENHEIRO ESTÁ OLHANDO.

                  Só em "aplicado", e isso é a regra e não um descuido: item
                  pendente é aquele cujo payload mudou DEPOIS de gerar, e
                  oferecer o arquivo velho ali desfaria o trabalho de fazer o
                  card parar de dizer "Gerado" para documento que envelheceu —
                  a LD errada sairia para a prefeitura com um botão verde ao
                  lado. Quem quiser o arquivo antigo regera.
                */}
                {estado === "aplicado" && salvo && !ocupado && (
                  <ResultLinks saved={salvo} />
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={gerarTudo}
            disabled={ocupado || semTitulo || Boolean(problemaDePrefeitura)}
          >
            {ocupado ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            {ocupado
              ? `Gerando ${(gerando ?? 0) + 1} de ${itens.length}…`
              : pendentes > 0
                ? /*
                   * O verbo diz o que está em jogo. "Gerar de novo" soa
                   * opcional; o documento no canvas está velho.
                   */
                  `Atualizar ${pendentes} documento${pendentes > 1 ? "s" : ""}`
                : tudoGerado
                  ? "Gerar de novo"
                  : `Gerar os ${itens.length}`}
          </Button>
          {/*
           * Antes aqui dizia "diga qual pela conversa" — mandando escrever num
           * chat um campo que agora está no card, aceso, na forma em que sai
           * impresso. A frase aponta para o campo, não para outro lugar.
           */}
          {(semTitulo || problemaDePrefeitura) && (
            <span className="text-xs text-muted-foreground">
              {problemaDePrefeitura
                ? /*
                   * A divergência ganha a frase INTEIRA, com os dois lados
                   * nomeados: "escolha a prefeitura" não serve para quem já
                   * escolheu — o problema dele é que a escolha não chegou nos
                   * dois documentos, e ele precisa saber em qual.
                   */
                  problemaDePrefeitura.tipo === "divergente"
                  ? problemaDePrefeitura.mensagem
                  : "Escolha a prefeitura acima."
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
