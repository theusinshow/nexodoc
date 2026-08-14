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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileText, ListChecks, Map, MapPin, ShieldCheck, SquareStack } from "lucide-react";

import { AuditResult, type AuditView } from "@/components/audit-result";
import { classifyFindingTier } from "@/lib/audit-report";
import { compararPareceres, resumoDoDiff } from "@/lib/diff-de-pareceres";
import { Chip } from "@/components/ui/chip";
import type { MemorialAuditResult } from "../lib/audit";
import { useConversation } from "../state/conversation-store";
import {
  auditoriaDaConversa,
  useAuditoria,
  type VistaDoPalco as Vista,
} from "../state/auditoria-store";
import { AuditCanvas } from "./AuditCanvas";
import { AuditoriaEmCurso } from "./AuditoriaEmCurso";
import type { AberturaPorLink } from "./use-abrir-auditoria-por-link";
import { useReconectarAuditoria } from "./use-reconectar-auditoria";

/**
 * As três vistas de LISTA do parecer. A quarta ("No documento") entra ao lado
 * delas na barra, mas não vive aqui: ela troca de componente, não de aba.
 */
const VISTAS_DO_PARECER: { valor: AuditView; rotulo: string; Icone: typeof FileText }[] = [
  { valor: "summary", rotulo: "Resumo", Icone: SquareStack },
  { valor: "findings", rotulo: "Achados", Icone: ListChecks },
  { valor: "report", rotulo: "Parecer", Icone: FileText },
];

export function PalcoDoNexo({
  mapa,
  /*
   * O ESTADO DA AUDITORIA PEDIDA POR LINK vem de fora, e não de um gancho aqui.
   *
   * O palco só monta quando há conversa; quem chega por `/nexo?auditoria=<id>`
   * pela primeira vez chega numa tela vazia, e o gancho aqui nunca rodava — o
   * pedido ao servidor não chegava a sair. Ele mora em [[NexoWorkspace.tsx]],
   * que está sempre montado, e o palco só desenha o que ele apurou.
   */
  aberturaPorLink,
}: {
  mapa: ReactNode;
  aberturaPorLink: AberturaPorLink;
}) {
  const {
    results,
    recuperarMemorial,
    achadosResolvidos,
    marcarAchadoResolvido,
    conversationId,
  } = useConversation();
  const { emCurso: emCursoGlobal, escolha, escolherVista } = useAuditoria();
  /*
   * Só a auditoria DESTA conversa. O store guarda uma auditoria por vez para o
   * aplicativo inteiro; trocar de conversa no meio de uma análise trazia o
   * progresso alheio para o palco da conversa nova. Ver `auditoriaDaConversa`.
   */
  const emCurso = auditoriaDaConversa(emCursoGlobal, conversationId);
  /*
   * O PDF DO MEMORIAL, para o achado poder ser conferido no documento.
   *
   * O relatório já sabia abrir a página exata e grifar o trecho — mas só quando
   * recebe `pdfSources`, e o palco nunca passava. Na prática o botão "ver no
   * documento" não existia aqui: o achado era uma afirmação sem como conferir,
   * que é justamente o que uma auditoria não pode ser.
   *
   * Os bytes vêm do memorial retido na conversa, então funciona também depois
   * de um F5 — que é quando o engenheiro volta para revisar com calma.
   */
  const [memorialPdf, setMemorialPdf] = useState<
    { name: string; url: string } | null
  >(null);

  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    void recuperarMemorial().then((guardado) => {
      if (!vivo || !guardado) return;
      url = URL.createObjectURL(guardado.file);
      setMemorialPdf({ name: guardado.file.name, url });
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recuperarMemorial]);
  // Auditoria herdada de outra sessão (F5, troca de conversa): o palco volta a
  // esperar por ela em vez de deixá-la morrer com a aba.
  const reconexao = useReconectarAuditoria();


  /*
   * A AUDITORIA QUE O PALCO MOSTRA É A MAIS RECENTE.
   *
   * Era `results.find(...)` — a PRIMEIRA da lista. E `saveResult` acrescenta um
   * artefato novo a cada auditoria, sem substituir o anterior: reauditar um
   * memorial corrigido gravava o parecer novo e o palco continuava exibindo o
   * velho. Reproduzido com duas auditorias semeadas na mesma conversa, a nova
   * com dois achados e a velha com cinco: a tela mostrava os cinco. A
   * reauditoria era invisível — e pior que invisível, porque a tela afirmava
   * com confiança o resultado errado.
   *
   * `generatedAt` é o critério, e não a posição no vetor: regerar um artefato
   * existente o substitui NO LUGAR, mantendo a posição antiga e atualizando o
   * carimbo. O `ConfirmationCard` já tratava "a última auditoria desta
   * conversa" como a base do delta; agora as duas telas concordam sobre qual é.
   */
  const auditorias = useMemo(
    () =>
      results
        .filter((r) => r.kind === "auditoria")
        .slice()
        .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0)),
    [results],
  );
  const auditoria = auditorias.at(-1);
  const salvo = auditoria?.payload as MemorialAuditResult | undefined;
  const report = salvo?.report;
  /*
   * O PARECER DE ANTES, quando existe. É o que permite dizer o que o trabalho
   * de correção mudou, em vez de entregar a lista nova como se fosse a primeira.
   */
  const reportAnterior = (auditorias.at(-2)?.payload as MemorialAuditResult | undefined)?.report;
  const diffDoParecer = useMemo(
    () =>
      report && reportAnterior
        ? resumoDoDiff(compararPareceres({ anterior: reportAnterior, atual: report }))
        : "",
    [report, reportAnterior],
  );
  // Os corrigidos DESTA auditoria: a conversa pode ter mais de uma ao longo do
  // tempo, e o progresso de uma não vale para a outra.
  const auditIdAtual = salvo?.auditId ?? "";
  const resolvidosDesta = useMemo(
    () => new Set(auditIdAtual ? (achadosResolvidos[auditIdAtual] ?? []) : []),
    [achadosResolvidos, auditIdAtual],
  );
  const temAuditoria = Boolean(
    emCurso || reconexao.pendente || report || aberturaPorLink.carregando || aberturaPorLink.falha,
  );

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
  /*
   * Parecer × documento. Local, e não no store, porque é uma preferência de
   * leitura do momento — não decide o que o palco mostra, só como. Só existe com
   * o PDF do memorial em mãos: sem os bytes, o canvas seria uma grade de ícones.
   */
  const [noDocumento, setNoDocumento] = useState(false);
  const podeVerNoDocumento = Boolean(report && memorialPdf);
  /*
   * A vista do parecer sobe para cá: as quatro vistas da auditoria (Resumo,
   * Achados, Relatório, No documento) são irmãs numa barra só. Antes eram dois
   * seletores empilhados — chips grandes aqui, um controle de 12px dentro do
   * parecer —, e o de baixo se lia como filtro da lista, não como troca de vista.
   */
  const [vistaDoParecer, setVistaDoParecer] = useState<AuditView>("summary");
  /*
   * A CONTAGEM DA ABA CONTA O QUE A LISTA MOSTRA.
   *
   * Era `incongruencias.length`, o total cru. Só que a lista tem duas camadas
   * desde o item 2: os achados sólidos ficam nela e os que a validação rebaixou
   * vão para a seção recolhível "Sugestões da IA". Reproduzido com seis achados
   * semeados, dois deles de confiança baixa: a aba prometia SEIS e a lista
   * entregava QUATRO. Quem confere um parecer conta os cartões, não acha os
   * dois que faltam, e conclui que o software perdeu achado.
   *
   * Não era divergência de estado, era o rótulo falando de outro conjunto — e a
   * tela já pagou por isso uma vez, quando o cartão de veredito dizia "3
   * críticas" e a matriz mostrava 2.
   *
   * `classifyFindingTier` é a MESMA função que a lista usa para decidir a
   * camada. Contar por qualquer outro critério traria a divergência de volta
   * pela porta dos fundos.
   */
  /*
   * Dentro de um `useMemo` não por custo, e sim porque `classifyFindingTier` é
   * opaca para o React Compiler: chamá-la solta sobre `report.incongruencias`
   * — que vem do mesmo `salvo` de onde sai o `auditIdAtual` — fazia ele
   * desistir de memoizar o conjunto de resolvidos logo acima.
   */
  const totalDeAchados = useMemo(
    () =>
      report?.incongruencias.filter((a) => classifyFindingTier(a) === "principal").length ?? 0,
    [report],
  );

  /*
   * O MESMO parecer nas duas vistas: inteiro quando é a vista, e dentro do
   * drawer quando o canvas está na frente. Escrito uma vez só — duas cópias
   * divergiriam no primeiro ajuste de props.
   */
  /*
   * O `!` de `salvo.auditId!` vivia dentro do JSX; com o parecer virando função
   * reaproveitada, a asserção passou a morar num fecho que o React Compiler não
   * consegue provar estável — e ele desistia de otimizar o palco inteiro. Aqui o
   * id é lido uma vez e a função só existe quando ele existe.
   */
  const aoAlternarResolvido = useMemo(() => {
    const id = salvo?.auditId;
    if (!id) return undefined;
    return (refId: string, resolvido: boolean) => marcarAchadoResolvido(id, refId, resolvido);
  }, [salvo?.auditId, marcarAchadoResolvido]);

  const parecerCom = (opts: { controlado: boolean; achadoEmFoco?: string }) =>
    report ? (
      <AuditResult
        content={salvo?.texto ?? ""}
        report={report}
        auditId={salvo?.auditId ?? undefined}
        pdfSources={memorialPdf ? [memorialPdf] : []}
        resolvidos={resolvidosDesta}
        onToggleResolvido={aoAlternarResolvido}
        /*
         * Na vista inteira quem manda na aba é a BARRA aqui de cima; dentro do
         * drawer do canvas não há barra por perto, então o parecer volta a ser
         * dono da própria vista e desenha o controle segmentado.
         */
        view={opts.controlado ? vistaDoParecer : undefined}
        onViewChange={opts.controlado ? setVistaDoParecer : undefined}
        achadoEmFoco={opts.achadoEmFoco}
      />
    ) : null;

  const parecer = parecerCom({ controlado: true });

  return (
    <div className="relative flex h-full w-full flex-col">
      {/*
        O seletor só aparece quando há duas vistas de fato. Com uma só, ele seria
        um controle que não controla nada.
      */}
      {temAuditoria && (
        <div className="flex shrink-0 items-center gap-1 px-1 pb-2">
          <Chip
            data-tour="chip-mapa"
            variant={mostrandoAuditoria ? "quiet" : "default"}
            onClick={() => escolher("mapa")}
            className="min-h-7 px-2.5 py-0.5 text-[11px]"
          >
            <Map aria-hidden />
            Mapa do volume
          </Chip>
          <Chip
            data-tour="chip-auditoria"
            variant={mostrandoAuditoria ? "default" : "quiet"}
            onClick={() => escolher("auditoria")}
            className="min-h-7 px-2.5 py-0.5 text-[11px]"
          >
            <ShieldCheck aria-hidden />
            Auditoria
          </Chip>

        </div>
      )}

      {/*
        A BARRA DE VISTAS — o segundo degrau, e só ele.
        Quatro leituras do MESMO parecer, irmãs entre si: três da lista e uma
        sobre as páginas do memorial. Fica abaixo do módulo e acima do conteúdo,
        que é onde uma troca de vista se lê como troca de vista.

        `flex-wrap` e não breakpoint de janela: aqui o palco é estreito mesmo com
        a janela larga (ver o parecer, que já apanhou disso).
      */}
      {mostrandoAuditoria && report && (
        <div
          /*
           * GRUPO DE BOTÕES, não `role="tablist"`. A ARIA de abas promete
           * navegação por setas, `aria-controls` e um `tabpanel` do outro lado —
           * anunciar "aba" sem entregar isso é pior para quem usa leitor de tela
           * do que o botão honesto que isto é. `aria-pressed` diz o que importa:
           * qual vista está ligada.
           */
          role="group"
          aria-label="Vistas da auditoria"
          className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-1 pb-2"
        >
          {VISTAS_DO_PARECER.map((v) => {
            const ativa = !noDocumento && vistaDoParecer === v.valor;
            return (
              <Chip
                key={v.valor}
                aria-pressed={ativa}
                variant={ativa ? "default" : "quiet"}
                onClick={() => {
                  setNoDocumento(false);
                  setVistaDoParecer(v.valor);
                }}
                className="min-h-8 px-3 text-xs"
              >
                <v.Icone aria-hidden />
                {v.rotulo}
                {/* A contagem mora na aba que a governa: é o número que decide
                    se vale abrir a lista, e ele estava enterrado no subtítulo. */}
                {v.valor === "findings" && totalDeAchados > 0 && (
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {totalDeAchados}
                  </span>
                )}
              </Chip>
            );
          })}
          {podeVerNoDocumento && (
            <Chip
              aria-pressed={noDocumento}
              data-tour="chip-no-documento"
              variant={noDocumento ? "default" : "quiet"}
              onClick={() => setNoDocumento(true)}
              className="min-h-8 px-3 text-xs"
            >
              <MapPin aria-hidden />
              No documento
            </Chip>
          )}
          {/*
            O QUE MUDOU DESDE A AUDITORIA ANTERIOR.

            Só aparece quando existe uma anterior nesta conversa — numa primeira
            auditoria não há com o que comparar, e uma faixa dizendo "0 saíram"
            seria ruído com cara de dado. Fica na barra de vistas, ao lado da
            contagem, porque responde à mesma pergunta que ela: quanto trabalho
            sobrou. Sem ela, o parecer da segunda rodada chega com cara de
            primeira, e o esforço de correção não aparece em lugar nenhum.
          */}
          {diffDoParecer && (
            <span
              data-diff-do-parecer
              className="ml-auto truncate font-mono text-[11px] text-muted-foreground"
              title="Comparado com a auditoria anterior desta conversa"
            >
              {diffDoParecer}
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1" data-tour="palco">
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
          ) : aberturaPorLink.carregando || aberturaPorLink.falha ? (
            /*
             * A auditoria pedida por link, enquanto vem do servidor ou quando
             * não veio. Uma tela em branco depois de clicar em ABRIR na home
             * seria a pior resposta possível: a pessoa não saberia se o link
             * está quebrado, se ela não tem acesso, ou se é só demora.
             */
            <div className="flex h-full items-start justify-center overflow-y-auto pt-10">
              <div className="max-w-md text-center">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {aberturaPorLink.carregando ? "Abrindo a auditoria" : "Não deu para abrir"}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {aberturaPorLink.carregando
                    ? "Buscando o parecer no servidor."
                    : aberturaPorLink.falha}
                </p>
              </div>
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
            noDocumento ? (
              <div className="h-full">
                <AuditCanvas
                  report={report}
                  pdfUrl={memorialPdf?.url}
                  // Montado no clique, já no achado que a pessoa apontou.
                  parecer={(achadoEmFoco) => parecerCom({ controlado: false, achadoEmFoco })}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto">{parecer}</div>
            )
          ) : null
        ) : (
          mapa
        )}
      </div>
    </div>
  );
}
