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

import { ResultadoDoParecer } from "@/components/telas/resultado/resultado";
import { useParecerVivo } from "@/components/telas/resultado/use-parecer-vivo";
import { compactarParaOPalco, soltarDoPalco } from "../lib/largura-do-copiloto";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Maximize2,
  PanelLeftClose,
  PanelRightClose,
  RotateCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Botao } from "@/components/ds/basicos";

import type { AuditView } from "@/components/audit-result";
import { classifyFindingTier } from "@/lib/audit-report";
import { compararPareceres } from "@/lib/diff-de-pareceres";
import {
  auditoriaMaisRecente,
  consultarAuditoria,
  type MemorialAuditResult,
} from "../lib/audit";
import { useConversation } from "../state/conversation-store";
import { useComposer } from "../state/composer-controller";
import {
  auditoriaDaConversa,
  useAuditoria,
  type VistaDoPalco as Vista,
} from "../state/auditoria-store";
import { auditoriaParaBuscarArquivos } from "@/lib/fonte-do-documento";
import { catalogoDoParecer, resolverFonte } from "@/lib/fonte-da-evidencia";

import { recolherConversasPelaFila, useAreasRecolhidas } from "../lib/areas-recolhidas";
import { TrilhoDoResultado } from "@/components/telas/resultado/trilho";
import { marcarDica, useDica } from "../lib/dicas-da-auditoria";
import { PASSOS_DO_TOUR_DO_RESULTADO } from "../lib/passos-do-tour-do-resultado";
import { ID_CONVERSA_EXEMPLO, ID_CONVERSA_MEMORIAL_EXEMPLO } from "../lib/projeto-exemplo";
import { useRetomada } from "../lib/retomada-do-tour";
import { TourDoNexo } from "./TourDoNexo";
import { AuditoriaEmCurso } from "./AuditoriaEmCurso";
import type { AberturaPorLink } from "./use-abrir-auditoria-por-link";
import { useReconectarAuditoria } from "./use-reconectar-auditoria";
import {
  detalheDoParecer,
  resumoDoParecer,
} from "@/lib/auditoria-incompleta";
import type { TextoCorrigido } from "@/lib/texto-corrigido";

/**
 * As três vistas de LISTA do parecer. A quarta ("No documento") entra ao lado
 * delas na barra, mas não vive aqui: ela troca de componente, não de aba.
 */

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
  obra,
}: {
  mapa: ReactNode;
  aberturaPorLink: AberturaPorLink;
  /** De que obra é a conversa (BarraDoNexo): o começo do cabeçalho do palco. */
  obra?: ReactNode;
}) {
  const {
    results,
    recuperarMemorial,
    achadosResolvidos,
    marcarAchadoResolvido,
    conversationId,
    saveResult,
    messages,
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
    { name: string; url: string; checksum: string | null } | null
  >(null);

  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    void recuperarMemorial().then(async (guardado) => {
      if (!vivo || !guardado) return;
      /*
       * O HASH DOS BYTES LOCAIS (A02/A03): é ele que diz se o memorial desta
       * conversa é a MESMA revisão que foi auditada. Sem `crypto.subtle`
       * (contexto inseguro), fica nulo — e o catálogo usa a cópia do servidor.
       */
      let checksum: string | null = null;
      try {
        const digest = await crypto.subtle.digest("SHA-256", await guardado.file.arrayBuffer());
        checksum = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        checksum = null;
      }
      if (!vivo) return;
      url = URL.createObjectURL(guardado.file);
      setMemorialPdf({ name: guardado.file.name, url, checksum });
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
   *
   * A ESCOLHA SAIU DAQUI em 25/08/2026 (`auditoriaMaisRecente`), porque ganhou
   * um terceiro consumidor: o chat da auditoria precisa responder sobre o MESMO
   * parecer que este palco desenha. Uma segunda cópia da regra acabaria
   * discordando, e aí o chat falaria de uma revisão e a tela mostraria outra.
   */
  const auditorias = useMemo(
    () =>
      results
        .filter((r) => r.kind === "auditoria")
        .slice()
        .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0)),
    [results],
  );
  const maisRecente = useMemo(() => auditoriaMaisRecente(results), [results]);
  /*
   * PERGUNTAR AO NEXO (o botão do trilho, desenho do lab): a conversa desta
   * auditoria já está ao lado; o gesto a traz de volta, se estiver recolhida, e
   * põe o cursor no campo. A pergunta é de quem pergunta: nada pré-escrito.
   */
  const composer = useComposer();
  const areasDoPalco = useAreasRecolhidas();
  const perguntarAoNexo = () => {
    if (areasDoPalco.chat) areasDoPalco.alternarChat();
    requestAnimationFrame(() => composer.focus());
  };
  /*
   * O CHAT DENTRO DO VISOR (05/10/2026, retorno de um usuário): o visor do PDF
   * cobre a conversa da direita, então a pergunta sobre o achado é feita ali
   * mesmo. É a MESMA conversa — a pergunta vai pelo composer do Nexo, e a
   * resposta é lida das mensagens dela —, e não um terceiro chat.
   */
  const chatDoVisor = useMemo(
    () => ({
      mensagens: messages,
      enviar: (texto: string) => {
        if (areasDoPalco.chat) areasDoPalco.alternarChat();
        requestAnimationFrame(() => composer.send(texto));
      },
    }),
    [messages, areasDoPalco, composer],
  );
  const salvo = maisRecente?.salvo;
  const report = salvo?.report;
  /*
   * O AVISO DE "NADA MUDOU" fecha por parecer: fechado o deste, o de um pedido
   * seguinte (outro artefato) volta a aparecer.
   */
  const [semMudancaFechado, setSemMudancaFechado] = useState<string | null>(null);
  const avisoSemMudanca =
    salvo?.semMudanca && maisRecente?.artifactId !== semMudancaFechado ? salvo.semMudanca.aviso : null;

  /*
   * O DOCUMENTO, LOCAL OU DO SERVIDOR.
   *
   * O local vem primeiro por ser instantâneo e não gastar rede — quem rodou a
   * auditoria não perde nada. Quem chegou pelo link do e-mail nunca teve o
   * memorial nesta máquina, e é para essa pessoa que o degrau do servidor
   * existe: era ela quem não tinha botão nenhum.
   *
   * A escolha é PURA e mora em [[lib/fonte-do-documento.ts]], com teste que roda
   * sem navegador.
   */
  /*
   * O PARECER GRAVADO PELO FLUXO NÃO TRAZ `arquivos` — só a consulta de
   * retomada traz. Sem o PDF local (outra máquina, outro navegador, cache
   * limpo) a aba sumia com o arquivo guardado no banco. Então pergunta ao
   * servidor, uma vez por auditoria. Ver `auditoriaParaBuscarArquivos`.
   */
  const auditIdParaBuscar = auditoriaParaBuscarArquivos({
    urlLocal: memorialPdf?.url ?? null,
    arquivos: salvo?.arquivos,
    auditId: salvo?.auditId,
  });
  const [buscados, setBuscados] = useState<{
    auditId: string;
    arquivos: NonNullable<MemorialAuditResult["arquivos"]>;
  } | null>(null);
  useEffect(() => {
    if (!auditIdParaBuscar) return;
    let vivo = true;
    void consultarAuditoria(auditIdParaBuscar)
      .then((estado) => {
        if (!vivo) return;
        setBuscados({
          auditId: auditIdParaBuscar,
          arquivos: estado.situacao === "pronta" ? (estado.resultado.arquivos ?? []) : [],
        });
      })
      .catch(() => {
        if (vivo) setBuscados({ auditId: auditIdParaBuscar, arquivos: [] });
      });
    return () => {
      vivo = false;
    };
  }, [auditIdParaBuscar]);
  const buscadosDestaAuditoria =
    buscados && buscados.auditId === auditIdParaBuscar ? buscados.arquivos : null;
  // A resposta ainda não voltou: dizer "não foi guardado" agora seria chute.
  const buscandoArquivos = Boolean(auditIdParaBuscar) && buscadosDestaAuditoria === null;

  /*
   * O CATÁLOGO DAS FONTES DESTE PARECER — um só, para o visor do achado, o
   * mapa "No documento" e o cartão do motor (A02/A03). Antes o visor recebia
   * "o primeiro arquivo com checksum" e o mapa só o PDF local; reaberto noutra
   * máquina, um mostrava a página e o outro uma grade de falhas.
   *
   * Enquanto a lista do servidor não volta, o local não entra: pode ser outra
   * revisão com o mesmo nome, e decidir antes seria chutar.
   */
  const catalogo = useMemo(
    () =>
      buscandoArquivos
        ? []
        : catalogoDoParecer({
            local: memorialPdf
              ? { nome: memorialPdf.name, url: memorialPdf.url, checksum: memorialPdf.checksum }
              : null,
            auditados: [...(salvo?.arquivos ?? []), ...(buscadosDestaAuditoria ?? [])],
          }),
    [buscandoArquivos, memorialPdf, salvo?.arquivos, buscadosDestaAuditoria],
  );
  /*
   * O DOCUMENTO DO MAPA: o arquivo que o parecer diz ter auditado
   * (`report.arquivo`), pela MESMA regra dos achados.
   */
  const doMapa = resolverFonte({ arquivo: salvo?.report?.arquivo ?? null }, catalogo);
  const fonte =
    doMapa.tipo === "arquivo"
      ? ({ tipo: doMapa.fonte.origem, url: doMapa.fonte.url } as const)
      : ({
          tipo: "ausente",
          // Sem fonte nenhuma, a frase de sempre: o parecer é anterior ao
          // armazenamento. Nos outros casos, o motivo específico do resolvedor.
          motivo:
            doMapa.motivo === "sem-fontes"
              ? "Este documento foi auditado antes de o sistema passar a guardá-lo."
              : doMapa.frase,
        } as const);
  const documento =
    doMapa.tipo === "arquivo" ? { name: doMapa.fonte.nome, url: doMapa.fonte.url } : null;
  /*
   * O PARECER DE ANTES, quando existe. É o que permite dizer o que o trabalho
   * de correção mudou, em vez de entregar a lista nova como se fosse a primeira.
   */
  const reportAnterior = (auditorias.at(-2)?.payload as MemorialAuditResult | undefined)?.report;
  // O cartão "Desde 18/09" do Resumo (desenho do lab): números, não a frase.
  const comparado = useMemo(() => {
    if (!report || !reportAnterior) return null;
    const d = compararPareceres({ anterior: reportAnterior, atual: report });
    return { desde: reportAnterior.runtime?.gerado_em ?? null, corrigidos: d.corrigidos.length, novos: d.novos.length, continuam: d.persistentes.length };
  }, [report, reportAnterior]);
  // Os corrigidos DESTA auditoria: a conversa pode ter mais de uma ao longo do
  // tempo, e o progresso de uma não vale para a outra.
  const auditIdAtual = salvo?.auditId ?? "";
  const resolvidosDesta = useMemo(
    () => new Set(auditIdAtual ? (achadosResolvidos[auditIdAtual] ?? []) : []),
    [achadosResolvidos, auditIdAtual],
  );
  const temAuditoria = Boolean(
    emCurso ||
      reconexao.pendente ||
      reconexao.falha ||
      report ||
      aberturaPorLink.carregando ||
      aberturaPorLink.falha,
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
      : reconexao.falha
        ? "retomada-falhou"
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

  /* Com o parecer no palco, o chat cede a largura; ele volta quando o parecer sai. */
  const parecerNoPalco = mostrandoAuditoria && Boolean(report) && !emCurso;
  useEffect(() => {
    if (!parecerNoPalco) return;
    compactarParaOPalco();
    return () => soltarDoPalco();
  }, [parecerNoPalco]);
  const podeVerNoDocumento = Boolean(report && documento);
  /*
   * A vista do parecer sobe para cá: as quatro vistas da auditoria (Resumo,
   * Achados, Relatório, No documento) são irmãs numa barra só. Antes eram dois
   * seletores empilhados — chips grandes aqui, um controle de 12px dentro do
   * parecer —, e o de baixo se lia como filtro da lista, não como troca de vista.
   */
  const [vistaDoParecer, setVistaDoParecer] = useState<AuditView | "geral">("summary");

  /*
   * O LINK QUE PEDE UM ACHADO ABRE A ABA ACHADOS.
   *
   * `AuditResult` faz isso sozinho, mas só quando é DONO da vista
   * (`if (achadoEmFoco && !controlado)`). Aqui ele é controlado — a barra de
   * vistas mora neste componente —, então quem tem de trocar é este componente.
   * Sem isto, o link do e-mail abria o parecer no Resumo e o achado pedido
   * ficava a uma aba de distância, que é metade da promessa do link.
   *
   * DERIVADO NA RENDERIZAÇÃO comparando com o valor anterior, e não num effect:
   * é o mesmo padrão de `audit-result.tsx:1224`, e o React Compiler barra
   * `setState` chamado direto do corpo de um efeito.
   *
   * Uma vez por achado pedido. Sem a comparação, cada render devolveria a vista
   * para Achados e a pessoa não conseguiria sair dela.
   */
  const [focoDoLink, setFocoDoLink] = useState<string | null>(null);

  /*
   * O ACHADO PEDIDO PELO CHAT (a citação "ACH-001 … p. 1" no fim da auditoria):
   * vai à fila, aberto nele. `vez` remonta o resultado, que só lê o foco ao nascer.
   */
  const [focoDoChat, setFocoDoChat] = useState<{ chave: string; vez: number } | null>(null);
  useEffect(() => {
    const abrir = (e: Event) => {
      const chave = (e as CustomEvent<{ chave?: string }>).detail?.chave;
      if (!chave) return;
      setNoDocumento(false);
      setVistaDoParecer("findings");
      setFocoDoChat({ chave, vez: Date.now() });
    };
    window.addEventListener("nexo:abrir-achado", abrir);
    return () => window.removeEventListener("nexo:abrir-achado", abrir);
  }, []);

  if (aberturaPorLink.achadoEmFoco !== focoDoLink) {
    setFocoDoLink(aberturaPorLink.achadoEmFoco);
    if (aberturaPorLink.achadoEmFoco) setVistaDoParecer("findings");
  }
  // `&fila=meus` (o e-mail, os atalhos "com você"): a fila, já em Meus. Uma vez por pedido.
  const [filaDoLink, setFilaDoLink] = useState<"meus" | null>(null);
  if (aberturaPorLink.fila !== filaDoLink) {
    setFilaDoLink(aberturaPorLink.fila);
    if (aberturaPorLink.fila) setVistaDoParecer("findings");
  }
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
  /* Quantos dos principais já foram tratados nesta conversa: o anel do trilho. */
  const tratadosDesta = useMemo(
    () => report?.incongruencias.filter((a) => classifyFindingTier(a) === "principal" && resolvidosDesta.has(a.id)).length ?? 0,
    [report, resolvidosDesta],
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

  /*
   * O PARECER VIVO (02/10/2026): os achados com o que o escritório já fez com
   * eles — desfecho, responsável, conversa —, lidos e gravados na rota de
   * feedback. Mora aqui, e não dentro do resultado, porque o anel do trilho
   * conta os mesmos desfechos que a fila mostra.
   */
  const parecerVivo = useParecerVivo({ auditId: salvo?.auditId ?? null, report: report ?? null, aoMudarResolvido: aoAlternarResolvido });
  const tratadosNoServidor = parecerVivo.achados.filter((a) => a.confirmado && a.desfecho).length;

  /*
   * O TEXTO CORRIGIDO NO NAVEGADOR. O servidor já gravou no `Audit.report`;
   * aqui o artefato é regravado NO LUGAR (mesmo `artifactId`), como o chat faz
   * com o achado que nasce na conversa — o parecer persiste em dois lugares e
   * os dois precisam concordar. Sem isto, depois do F5 o botão chamaria a rota
   * de novo (de graça, porque ela devolve o gravado, mas com a espera).
   */
  const aoGerarTextoCorrigido = (findingId: string, texto: TextoCorrigido) => {
    const atual = auditoriaMaisRecente(results);
    if (!atual) return;
    const reportNovo = {
      ...atual.salvo.report,
      incongruencias: atual.salvo.report.incongruencias.map((f) =>
        f.id === findingId ? { ...f, texto_corrigido: texto } : f,
      ),
    };
    void saveResult({
      artifactId: atual.artifactId,
      kind: "auditoria",
      summary: resumoDoParecer(reportNovo),
      files: [],
      payload: { ...atual.salvo, report: reportNovo },
      canvas: { label: "Auditoria", detail: detalheDoParecer(reportNovo) },
    });
  };


  /*
   * O ACHADO PEDIDO PELO LINK vai para a vista INTEIRA — que é onde quem chega
   * pelo e-mail cai. O AuditResult já sabe o resto: troca para a aba Achados,
   * rola até o cartão e o faz piscar uma vez.
   *
   * A gaveta do canvas (linha abaixo) tem o próprio foco, vindo do clique num
   * card. São duas origens diferentes para a mesma prop, e misturá-las faria um
   * clique no canvas ser desfeito pelo parâmetro da URL a cada render.
   */

  /*
   * A FILA PRECISA DA LARGURA (07/10/2026, U11): com a fila aberta e a janela
   * abaixo de 1600 px, a lista de conversas recolhe sozinha — só enquanto a
   * fila estiver aberta, sem gravar a escolha. Ver `areas-recolhidas.ts`.
   */
  const naFila = mostrandoAuditoria && Boolean(report) && !noDocumento && vistaDoParecer === "findings";
  useEffect(() => {
    if (!naFila || window.innerWidth >= 1600) return;
    recolherConversasPelaFila(true);
    return () => recolherConversasPelaFila(false);
  }, [naFila]);

  /*
   * O PASSO A PASSO DO RESULTADO: cada parte e cada botão (08/10/2026). Abre
   * sozinho na primeira vez que a pessoa vê um parecer, e depois pelo "?" do
   * trilho. Não abre sobre o aviso "nada mudou" (é um diálogo) nem sobre o
   * parecer do projeto de exemplo — ali quem fala é o tour do Nexo.
   */
  const tourDoResultado = useDica("tour-do-resultado");
  const [tourPedido, setTourPedido] = useState(false);
  // Quem saiu no meio (clique fora, Esc) volta ao passo em que estava.
  const tourPelaMetade = Boolean(useRetomada("resultado"));
  const tourDoResultadoAberto =
    Boolean(report) &&
    mostrandoAuditoria &&
    !avisoSemMudanca &&
    (tourPedido || (tourDoResultado.mostrar && conversationId !== ID_CONVERSA_EXEMPLO));
  const sairDoTourDoResultado = () => {
    setTourPedido(false);
    tourDoResultado.fechar();
  };
  // O passo "Encerrar o achado" diz o que a dica da primeira revisão diria, e
  // a dica aberta na fila taparia o que o passo aponta.
  useEffect(() => {
    if (tourDoResultadoAberto) marcarDica("primeira-revisao");
  }, [tourDoResultadoAberto]);

  return (
    <div className="nw-palco nx-palco relative flex h-full w-full flex-col">
      {/*
        O seletor só aparece quando há duas vistas de fato. Com uma só, ele seria
        um controle que não controla nada.
      */}
      <header className="nw-palco-cabeca nx-palco-cabeca">
        {obra}
        {/* O parecer do memorial de exemplo é escrito à mão: o palco diz isso no alto, onde o veredito é lido. */}
        {conversationId === ID_CONVERSA_MEMORIAL_EXEMPLO && (
          <span className="ds-pill ds-pill--line" data-selo-exemplo title="Memorial e parecer fabricados para mostrar o caminho. Nenhum modelo rodou.">
            Exemplo
          </span>
        )}
        {/* As vistas só aparecem quando há duas de fato: com uma, seriam um controle que não controla nada. */}
        {temAuditoria && (
          <span className="nw-vistas" role="group" aria-label="Vistas do palco">
            <button type="button" data-tour="chip-auditoria" aria-pressed={mostrandoAuditoria} onClick={() => escolher("auditoria")}>
              Auditoria
            </button>
            <button type="button" data-tour="chip-mapa" aria-pressed={!mostrandoAuditoria} onClick={() => escolher("mapa")}>
              Mapa do volume
            </button>
          </span>
        )}
        <EspacoDaRevisao />
      </header>

      {/*
        AS NOTAS DO PARECER, numa linha fina acima do conteúdo: por que a vista
        "No documento" não está aqui (botão ausente não se distingue de função
        inexistente) e o que mudou desde a rodada anterior. A navegação entre
        as vistas foi para o trilho da direita (Resultado E).
      */}
      {mostrandoAuditoria && report && !emCurso && fonte.tipo === "ausente" && !buscandoArquivos ? (
        <div className="nx-notas-do-parecer">
          {report && fonte.tipo === "ausente" && !buscandoArquivos ? (
            <span className="nx-vistas-nota">
              {fonte.motivo}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1" data-tour="palco">
        {mostrandoAuditoria ? (
          emCurso ? (
            <div className="h-full overflow-y-auto">
              <AuditoriaEmCurso
                nivel={emCurso.nivel}
                arquivo={emCurso.arquivo}
                inicioMs={emCurso.inicioMs}
                marcos={emCurso.marcos}
                onCancelar={emCurso.cancelar}
                obra={emCurso.obra}
                codigo={emCurso.codigo}
                prefeitura={emCurso.prefeitura}
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
              <div
                className="max-w-md text-center"
                data-abertura-por-link={aberturaPorLink.carregando ? "carregando" : aberturaPorLink.tipoDaFalha ?? "falha"}
                role={aberturaPorLink.carregando ? "status" : "alert"}
              >
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {aberturaPorLink.carregando ? "Abrindo a auditoria" : "Não deu para abrir"}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {aberturaPorLink.carregando
                    ? "Buscando o parecer no servidor."
                    : aberturaPorLink.falha}
                </p>
                {/*
                  A SAÍDA DE CADA FALHA (A01). Sem ela a pessoa lia o motivo e
                  ficava num palco vazio: temporária/rede/ainda rodando tentam
                  de novo; sessão entra com o MESMO destino; as outras voltam ao
                  painel, onde estão as pendências dela.
                */}
                {!aberturaPorLink.carregando && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {aberturaPorLink.tipoDaFalha === "temporaria" ||
                    aberturaPorLink.tipoDaFalha === "rede" ||
                    aberturaPorLink.tipoDaFalha === "rodando" ? (
                      <Button type="button" size="sm" onClick={aberturaPorLink.tentarDeNovo}>
                        <RotateCw aria-hidden />
                        Tentar de novo
                      </Button>
                    ) : null}
                    {aberturaPorLink.tipoDaFalha === "sem-sessao" ? (
                      <Button asChild size="sm">
                        <a
                          href={`/login?callbackUrl=${encodeURIComponent(
                            typeof window === "undefined"
                              ? "/nexo"
                              : `${window.location.pathname}${window.location.search}`,
                          )}`}
                        >
                          Entrar e abrir este parecer
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link href="/">Voltar ao painel</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : reconexao.pendente ? (
            /*
             * Retomada: sem marcos, porque o fluxo de eventos morreu junto com a
             * conexão anterior. Inventar etapas para preencher a espera seria a
             * animação que este módulo se recusa a fazer — a tela diz só o que
             * sabe, e o resultado aparece quando o servidor terminar.
             */
            <div className="h-full overflow-y-auto">
              <AuditoriaEmCurso
                nivel={reconexao.pendente.nivel}
                arquivo={reconexao.pendente.arquivo}
                inicioMs={reconexao.pendente.inicioMs}
                marcos={[]}
                retomada
              />
            </div>
          ) : reconexao.falha ? (
            /*
             * A RETOMADA QUE NÃO DEU — e ela não tinha tela.
             *
             * `useReconectarAuditoria` sempre devolveu `falha`, e ninguém a
             * lia: quando o servidor respondia FAILED, o cartão de "análise em
             * curso" simplesmente SUMIA, e o palco voltava ao mapa como se nada
             * tivesse sido pedido. A pessoa tinha esperado seis minutos por um
             * parecer, e a resposta foi uma tela trocar de assunto.
             *
             * Passou a importar em 03/09/2026, quando a auditoria órfã de um
             * container reiniciado deixou de ficar "rodando" para sempre e
             * passou a voltar como falha COM MOTIVO — o motivo que esta caixa
             * mostra, e que diz o que fazer (rodar de novo).
             *
             * Mesma forma da abertura por link logo acima, de propósito: são a
             * mesma situação para quem olha — pedi um parecer, não veio, e
             * preciso saber por quê.
             */
            <div className="flex h-full items-start justify-center overflow-y-auto pt-10">
              <div className="max-w-md text-center" data-retomada-falhou>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  A análise não terminou
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{reconexao.falha}</p>
                {/*
                 * Sem acesso (403) a espera fica guardada para o acesso que
                 * voltar — e sem este botão não havia como sair dela
                 * (15/09/2026, jornada x3).
                 */}
                {reconexao.descartar ? (
                  <button
                    type="button"
                    onClick={reconexao.descartar}
                    className="mt-4 text-sm underline underline-offset-4 hover:text-foreground"
                  >
                    Descartar esta espera
                  </button>
                ) : null}
              </div>
            </div>
          ) : report ? (
            /*
             * O RESULTADO E: o conteúdo à esquerda e o trilho à direita, com o
             * veredito, o tratado e as quatro leituras do mesmo parecer.
             */
            <div className="nx-resultado re-corpo--compacto">
              {avisoSemMudanca && (
                <div className="nx-sem-mudanca" role="dialog" aria-modal="false" aria-labelledby="nx-sem-mudanca-titulo">
                  <div className="nx-sem-mudanca-cartao">
                    <p id="nx-sem-mudanca-titulo" className="nx-sem-mudanca-titulo">
                      Nada mudou desde a última auditoria
                    </p>
                    <p className="nx-sem-mudanca-texto">
                      {avisoSemMudanca} Abri o parecer dela: os achados e o que já foi tratado continuam valendo.
                    </p>
                    <Botao variante="primary" autoFocus onClick={() => setSemMudancaFechado(maisRecente?.artifactId ?? null)}>
                      Ver o parecer
                    </Botao>
                  </div>
                </div>
              )}
              <div className="nx-resultado-miolo" data-tour="palco-do-resultado">
                <div className="h-full overflow-y-auto">
                  <ResultadoDoParecer
                    key={focoDoChat?.vez ?? "parecer"}
                    report={report}
                    parecer={parecerVivo}
                    auditId={salvo?.auditId ?? null}
                    catalogo={catalogo}
                    vista={noDocumento ? "documento" : vistaDoParecer}
                    onVista={(v) => {
                      if (v === "documento") setNoDocumento(true);
                      else {
                        setNoDocumento(false);
                        setVistaDoParecer(v);
                      }
                    }}
                    podeVerNoDocumento={podeVerNoDocumento}
                    achadoEmFoco={focoDoChat?.chave ?? aberturaPorLink.achadoEmFoco ?? null}
                    filaInicial={focoDoChat ? null : aberturaPorLink.fila}
                    chatDoVisor={chatDoVisor}
                    aoGerarTexto={aoGerarTextoCorrigido}
                    comparado={comparado}
                    total={totalDeAchados}
                    tratados={salvo?.auditId ? tratadosNoServidor : tratadosDesta}
                  />
                </div>
              </div>
              <TrilhoDoResultado
                compacto
                /* Com o chat aberto ao lado, o botão não mudava nada na tela (R10). */
                onPerguntar={areasDoPalco.chat ? perguntarAoNexo : undefined}
                onTutorial={() => setTourPedido(true)}
                tutorialPelaMetade={tourPelaMetade}
                report={report}
                total={totalDeAchados}
                tratados={salvo?.auditId ? tratadosNoServidor : tratadosDesta}
                vista={noDocumento ? "documento" : vistaDoParecer}
                podeVerNoDocumento={podeVerNoDocumento}
                onVista={(v) => {
                  if (v === "documento") setNoDocumento(true);
                  else {
                    setNoDocumento(false);
                    setVistaDoParecer(v);
                  }
                }}
              />
              {tourDoResultadoAberto && (
                <TourDoNexo
                  passos={PASSOS_DO_TOUR_DO_RESULTADO}
                  rotulo="Passo a passo do resultado da auditoria"
                  rotuloFinal="Entendi"
                  roteiro="resultado"
                  aoSair={sairDoTourDoResultado}
                />
              )}
            </div>
          ) : null
        ) : (
          mapa
        )}
      </div>
    </div>
  );
}

/**
 * OS CONTROLES DO ESPAÇO — auditoria UX/UI, G05. Botões nomeados para recolher
 * a lista de projetos, o chat, ou os dois ("Foco na revisão"). A escolha fica
 * guardada e volta na próxima visita; o chat recolhido continua montado.
 */
/**
 * O ESPAÇO DA REVISÃO: foco (palco sozinho), recolher as conversas, recolher o
 * chat. Ícones com nome (aria-label e title): ícone sem nome é adivinhação.
 */
function EspacoDaRevisao() {
  const areas = useAreasRecolhidas();
  const foco = areas.foco ? "Sair do foco" : "Foco na revisão";
  const projetos = areas.projetos ? "Mostrar conversas" : "Ocultar conversas";
  const chat = areas.chat ? "Mostrar chat" : "Ocultar chat";
  return (
    <span role="group" aria-label="Espaço da revisão" className="nw-espaco nx-espaco" data-espaco-da-revisao>
      <button type="button" aria-pressed={areas.foco} onClick={areas.alternarFoco} aria-label={foco} title={foco}>
        <Maximize2 size={15} aria-hidden />
      </button>
      <button type="button" aria-pressed={areas.projetos} onClick={areas.alternarProjetos} aria-label={projetos} title={projetos}>
        <PanelLeftClose size={15} aria-hidden />
      </button>
      <button type="button" aria-pressed={areas.chat} onClick={areas.alternarChat} aria-label={chat} title={chat}>
        <PanelRightClose size={15} aria-hidden />
      </button>
    </span>
  );
}
