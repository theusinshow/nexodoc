"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro, type ReactNode } from "react";
import { Page, pdfjs } from "react-pdf";
import { Skeleton } from "@/components/ui/skeleton";
import { alturasDosPinos, caixasPelaGeometria, faixasPorLinha, segmentosPorItem, type Caixa, type ItemComGeometria } from "@/lib/faixas-do-grifo";
import { usePdfCompartilhado } from "./pdf-compartilhado";
import { marcacaoDoTrecho, type FaixasDaMarcacao } from "@/lib/marcacao-do-trecho";
import type { ItemDeTexto } from "@/lib/texto-do-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./audit-pdf-grifo.css";

// IMPORTANTE: o worker precisa casar com a versão do pdfjs que o react-pdf usa
// (nested 5.4.296), não com o engine 5.7.284 do repo — senão dá
// "API version does not match Worker version" e nada renderiza. Este arquivo é
// cópia do worker do próprio react-pdf.
pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/pdf.worker.react-pdf.mjs";

/**
 * A largura de uma página em 100%. 520px numa gaveta de 560 é a página inteira
 * à vista, que é o enquadramento certo para "onde está o trecho". Para LER o
 * trecho é que existe o zoom — e é por isso que ele multiplica este número em
 * vez de substituí-lo.
 */
export const LARGURA_BASE_DA_PAGINA = 520;

/** Outro achado da mesma página: grifo tênue no tom dele, com pino na margem. */
export type GrifoDeOutro = { chave: string; tom?: string; rotulo: string; titulo: string; candidatos: readonly string[] };

// Separadores da chave estável dos outros achados (não aparecem em texto de PDF).
const SEP_TERMO = "\u0000";
const SEP_CHAVE = "\u0002";
const SEP_ACHADO = "\u0003";
const TAMANHO_DO_PINO = 20;

/** O primeiro candidato que casa NESTA página (a régua de `marcacaoDoTrecho`). */
function primeiroQueCasa(itens: ItemDeTexto[], termos: readonly string[]): FaixasDaMarcacao | null {
  for (const termo of termos) {
    if (termo.trim().length < 3) continue;
    const achadas = marcacaoDoTrecho(itens, termo);
    if (achadas.size > 0) return achadas;
  }
  return null;
}

type AuditPdfViewerInternalProps = {
  url: string;
  page: number;
  /**
   * O que grifar. Uma LISTA vale pelo primeiro que casar nesta página — ver
   * `lib/grifo-do-achado.ts` (o trecho da página, o termo, as citações, os
   * pedaços da evidência). Uma string é a lista de um.
   */
  highlight?: string | readonly string[];
  /** Multiplicador da largura da página. 1 = a página inteira na gaveta. */
  zoom?: number;
  /**
   * Quantas páginas o documento tem — sobe para o dono montar a régua de
   * achados na margem. A posição de um pin é uma FRAÇÃO do documento, e só
   * quem abriu o PDF sabe o tamanho dele.
   */
  onNumPages?: (n: number) => void;
  /**
   * Avisa, quando a página e o texto dela chegam, se o trecho foi achado nela.
   * O visor do Resultado usa para ir sozinho à página do achado que tem o grifo.
   */
  onGrifo?: (achou: boolean, pagina: number) => void;
  /**
   * "contida": rola só a caixa da prévia (o ancestral com `data-previa`) até a
   * marca, nos dois eixos, sem mexer no painel em volta. O padrão,
   * `scrollIntoView`, rola TODO ancestral — dentro do detalhe do achado isso
   * arrastaria o painel inteiro.
   */
  rolagem?: "janela" | "contida";
  /**
   * A gravidade do achado (`block`, `decide`, `note`, `texto`): pinta o grifo
   * no tom dela. Sem ela, o amarelo de marca-texto.
   */
  tom?: string;
  /**
   * TODOS OS ACHADOS DA PÁGINA (08/10/2026): os outros achados desta folha,
   * grifados mais fracos, cada um no tom dele. O ativo continua sendo o
   * `highlight` — e, se dois trechos disputam o mesmo texto, ele ganha.
   */
  outros?: readonly GrifoDeOutro[];
  /** O pino do ativo. Com ele (e `onEscolher`), cada grifo ganha um pino na margem da folha. */
  pinoDoAtivo?: { chave: string; rotulo: string; titulo: string };
  /** Clicar no pino de outro achado torna-o o ativo. */
  onEscolher?: (chave: string) => void;
  /** O achado sob o mouse (na lista ao lado ou no pino): o grifo dele acende. */
  realce?: string | null;
  onRealce?: (chave: string | null) => void;
  /**
   * O BALÃO DO ACHADO (08/10/2026): o conteúdo vem do dono; aqui ele é
   * ancorado no trecho do ativo — embaixo da última linha, ou em cima da
   * primeira quando o trecho está no pé da folha — e rola junto com a página.
   */
  balao?: ReactNode;
  /** Muda quando o dono pede o balão de volta ao trecho (G): desfaz o arrasto. */
  voltaDoBalao?: number;
  /**
   * A largura da página em 100%, quando o dono mede o espaço (as duas folhas
   * lado a lado). Sem ela, `LARGURA_BASE_DA_PAGINA`.
   */
  largura?: number;
};
const LARGURA_DO_BALAO = 360;

function escaparHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Visor embutido de PDF da auditoria: renderiza a página do achado e marca o
 * trecho citado como evidência.
 *
 * COMO A MARCAÇÃO FUNCIONA — e por que ela mudou (24/08/2026).
 *
 * Antes: uma expressão regular com o trecho inteiro E cada palavra dele com 4
 * letras ou mais, aplicada a cada span isoladamente. O remendo da palavra solta
 * existia porque o pdf.js corta o texto em spans e uma frase raramente cabe num
 * só — mas numa página de memorial "revestimento" e "conforme" aparecem dezenas
 * de vezes, e a folha inteira acendia. O relato foi "a marcação está ficando
 * imprecisa"; o diagnóstico é que ela nunca soube ONDE o trecho estava.
 *
 * Agora: `onGetTextSuccess` entrega os itens da página ANTES de o texto ser
 * pintado, `marcacaoDoTrecho` costura esses itens na ordem de leitura (com a
 * mesma medida da extração) e devolve as faixas de caractere da ÚNICA ocorrência
 * certa. O `customTextRenderer` recebe `itemIndex` e recorta só o que é dele.
 *
 * Sem os itens ainda (primeiro quadro) não marca nada: o estado chega logo
 * depois e o React repinta. Marca nenhuma por um quadro é melhor que a marca
 * errada, que é o que se está consertando.
 */
export default function AuditPdfViewerInternal({
  url,
  page,
  highlight,
  zoom = 1,
  onNumPages,
  onGrifo,
  rolagem = "janela",
  tom,
  outros,
  pinoDoAtivo,
  onEscolher,
  realce,
  onRealce,
  balao,
  voltaDoBalao,
  largura = LARGURA_BASE_DA_PAGINA,
}: AuditPdfViewerInternalProps) {
  // O documento é emprestado de `pdf-compartilhado`: a prévia, o visor e o
  // lado a lado abrem o mesmo memorial uma vez só.
  const pdf = usePdfCompartilhado(url);
  const numPages = pdf ? pdf.numPages : 0;
  useEffect(() => {
    if (pdf) onNumPages?.(pdf.numPages);
  }, [pdf, onNumPages]);
  const [itens, setItens] = useState<ItemDeTexto[] | null>(null);
  // A folha carregada (para a geometria) e o ascendente de cada fonte dela.
  const [folhaPdf, setFolhaPdf] = useState<{ numero: number; pagina: { getViewport: (p: { scale: number }) => { transform: number[]; scale: number; width: number; height: number } } } | null>(null);
  const [ascendentes, setAscendentes] = useState<Record<string, number>>({});
  const caixa = useRef<HTMLDivElement>(null);
  const candidatos = useMemo(
    () => (typeof highlight === "string" ? [highlight] : (highlight ?? [])).map((t) => t.trim()).filter((t) => t.length >= 3),
    [highlight],
  );
  // Chave estável para os efeitos: a lista chega nova a cada render do dono.
  const needle = candidatos.join("\u0000");
  // A mesma ideia para os outros achados: a lista chega nova a cada render, a
  // chave só muda quando muda o que grifar.
  const chaveDosOutros = (outros ?? []).map((o) => `${o.chave}${SEP_CHAVE}${o.candidatos.join(SEP_TERMO)}`).join(SEP_ACHADO);

  /*
   * A página muda: os itens da anterior não valem mais. Sem isto o visor
   * marcaria, por um quadro, faixas calculadas sobre outra folha — que é pior
   * que não marcar, porque parece certo.
   */
  const [paginaDosItens, setPaginaDosItens] = useState(0);

  const faixas: FaixasDaMarcacao | null = useMemo(() => {
    if (!itens || paginaDosItens !== page || needle.length < 3) return null;
    // O primeiro candidato que casa NESTA página; a régua de cada um continua
    // a de `marcacaoDoTrecho` (duas palavras no mínimo).
    for (const termo of needle.split("\u0000")) {
      const achadas = marcacaoDoTrecho(itens, termo);
      if (achadas.size > 0) return achadas;
    }
    return new Map() as FaixasDaMarcacao;
  }, [itens, paginaDosItens, page, needle]);

  const faixasDosOutros = useMemo(() => {
    if (!itens || paginaDosItens !== page || !chaveDosOutros) return [];
    return chaveDosOutros.split(SEP_ACHADO).map((um) => primeiroQueCasa(itens, um.split(SEP_CHAVE)[1]?.split(SEP_TERMO) ?? []));
  }, [itens, paginaDosItens, page, chaveDosOutros]);

  // Um pedaço por item, sem sobreposição; o grifo 0 é o ativo.
  const segmentos = useMemo(() => segmentosPorItem([faixas, ...faixasDosOutros]), [faixas, faixasDosOutros]);

  /*
   * ROLAR ATÉ O GRIFO. Com zoom acima de 100% a folha passa da gaveta, e a
   * marca podia estar fora da vista — o visor dizia "achei" e mostrava o topo.
   * Depois que a camada de texto pinta, a primeira marca vem para o centro.
   */
  const rolarAteOGrifo = useCallback(() => {
    if (!faixas || faixas.size === 0) return;
    // A faixa chega antes da marca (ver "o grifo antes da camada"); a marca é o reserva.
    const marca = caixa.current?.querySelector(".grifo-faixa--ativo") ?? caixa.current?.querySelector('mark[data-g="0"]');
    if (!marca) return;
    if (rolagem === "contida") {
      const janela = caixa.current?.closest<HTMLElement>("[data-previa]");
      if (!janela) return;
      const m = marca.getBoundingClientRect();
      const j = janela.getBoundingClientRect();
      janela.scrollTop += m.top - j.top - (j.height - m.height) / 2;
      janela.scrollLeft += m.left - j.left - Math.max(16, (j.width - m.width) / 2);
      return;
    }
    marca.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [faixas, rolagem]);

  /*
   * O MARCA-TEXTO CONTÍNUO (08/10/2026). O `<mark>` fica na camada de texto —
   * é ele que a seleção e o Ctrl+F acham —, mas transparente. O que se vê são
   * as faixas: as caixas dos `<mark>` medidas depois que a camada pinta, uma
   * por linha (`lib/faixas-do-grifo.ts`), desenhadas por baixo do texto.
   *
   * A faixa se pinta da esquerda para a direita UMA vez quando o grifo chega
   * (página ou trecho novos). Zoom só remede: a mesma marca não chega de novo.
   */
  const [desenho, setDesenho] = useState<{
    chave: string;
    grupos: { grifo: number; faixas: Caixa[] }[];
    pintar: boolean;
    largura: number;
    altura: number;
    /** Pela geometria do texto, antes da camada: as marcas ainda vão acertar o contorno. */
    estimado: boolean;
  } | null>(null);
  const ultimaPintada = useRef("");
  const chaveDoDesenho = `${page}|${needle}|${chaveDosOutros}`;
  const publicar = useCallback(
    (porGrifo: Map<number, Caixa[]>, largura: number, altura: number, estimado: boolean) => {
      const doAtivo = `${page}|${needle}`;
      const chave = `${page}|${needle}|${chaveDosOutros}`;
      const grupos = [...porGrifo].sort(([a], [b]) => a - b).map(([grifo, caixas]) => ({ grifo, faixas: faixasPorLinha(caixas) }));
      // Só o ATIVO chegando pinta: trocar os outros ou o zoom não é chegada.
      const chega = porGrifo.has(0) && ultimaPintada.current !== doAtivo;
      if (porGrifo.has(0)) ultimaPintada.current = doAtivo;
      // O contorno exato que substitui o estimado continua a MESMA chegada: a pintura não recomeça.
      setDesenho((antes) => ({ chave, grupos, pintar: chega || Boolean(antes?.estimado && antes.chave === chave && antes.pintar), largura, altura, estimado }));
    },
    [page, needle, chaveDosOutros],
  );
  const medirOGrifo = useCallback(() => {
    const marcas = [...(caixa.current?.querySelectorAll<HTMLElement>(".textLayer mark[data-g]") ?? [])];
    const folha = marcas[0]?.closest<HTMLElement>(".react-pdf__Page");
    if (!folha) {
      setDesenho(null);
      return;
    }
    const f = folha.getBoundingClientRect();
    // Com `zoom` de CSS no caminho (a `.ds` em tela larga), a caixa medida e o
    // px do `position: absolute` diferem; a razão desfaz a diferença.
    const escala = f.width / (folha.offsetWidth || f.width);
    const porGrifo = new Map<number, Caixa[]>();
    for (const m of marcas) {
      const g = Number(m.dataset.g);
      const lista = porGrifo.get(g) ?? [];
      for (const r of m.getClientRects()) lista.push({ x: (r.left - f.left) / escala, y: (r.top - f.top) / escala, w: r.width / escala, h: r.height / escala });
      porGrifo.set(g, lista);
    }
    publicar(porGrifo, folha.offsetWidth, folha.offsetHeight, false);
  }, [publicar]);

  /*
   * AS MARCAS SEM REDESENHAR A CAMADA (08/10/2026). As marcas entravam pelo
   * `customTextRenderer` do react-pdf, e ele está nas dependências do efeito
   * que desenha a camada de texto: cada vez que os trechos mudavam — e eles
   * SEMPRE mudam logo depois do primeiro desenho, quando os itens chegam — o
   * react-pdf jogava a camada fora e media todas as palavras da página de
   * novo. Medido no 117-25: ~280 ms a mais para abrir, e de novo a cada troca
   * de achado. Agora a camada é desenhada uma vez e as marcas entram nos spans
   * prontos, com o mesmo pareamento item → span que o react-pdf usa.
   */
  const camadaPronta = useRef(false);
  const marcados = useRef<{ el: HTMLElement; str: string }[]>([]);
  const ultimoRolado = useRef("");
  const aplicarMarcas = useCallback(() => {
    const camada = caixa.current?.querySelector<HTMLElement>(".textLayer");
    if (!camada || !itens || paginaDosItens !== page) return false;
    for (const { el, str } of marcados.current) if (el.isConnected) el.textContent = str;
    marcados.current = [];
    const filhos = camada.querySelectorAll<HTMLElement>('[role="presentation"]');
    let indice = 0;
    itens.forEach((item, itemIndex) => {
      const filho = filhos[indice];
      // Igual ao react-pdf: o fim de linha do pdf.js é um <br> que ocupa um índice.
      indice += item.str && (item as { hasEOL?: boolean }).hasEOL ? 2 : 1;
      const trechos = segmentos.get(itemIndex);
      if (!filho || !trechos?.length) return;
      /*
       * Montado por FATIA, e não por `replace`: as faixas vêm em índice de
       * caractere, e reconstruir o texto pedaço a pedaço é o que garante que a
       * marca caia exatamente onde o casamento caiu — inclusive no meio de uma
       * palavra que o pdf.js entregou colada a outra.
       */
      const str = item.str;
      let saida = "";
      let cursor = 0;
      for (const { inicio, fim, grifo } of trechos) {
        saida += escaparHtml(str.slice(cursor, inicio));
        saida += `<mark data-g="${grifo}">${escaparHtml(str.slice(inicio, fim))}</mark>`;
        cursor = fim;
      }
      filho.innerHTML = saida + escaparHtml(str.slice(cursor));
      marcados.current.push({ el: filho, str });
    });
    return true;
  }, [itens, paginaDosItens, page, segmentos]);

  // A camada vai ser desenhada de novo (página, zoom, largura): espera o aviso dela.
  useEffect(() => {
    camadaPronta.current = false;
  }, [page, zoom, largura]);

  /*
   * O GRIFO ANTES DA CAMADA (08/10/2026): os itens chegam junto com a folha, e a
   * camada de texto leva de 250 a 450 ms depois disso. Enquanto ela não vem, a
   * faixa sai da geometria dos itens (`caixasPelaGeometria`); quando ela chega,
   * as caixas reais das marcas acertam o contorno.
   */
  useEffect(() => {
    if (camadaPronta.current || !itens || paginaDosItens !== page || !folhaPdf || folhaPdf.numero !== page || segmentos.size === 0) return;
    const base = folhaPdf.pagina.getViewport({ scale: 1 });
    const vista = folhaPdf.pagina.getViewport({ scale: (largura * zoom) / base.width });
    const porGrifo = caixasPelaGeometria(itens as unknown as ItemComGeometria[], segmentos, vista, (fonte) => ascendentes[fonte ?? ""] ?? 0.8);
    if (porGrifo.size > 0) publicar(porGrifo, vista.width, vista.height, true);
  }, [itens, paginaDosItens, page, folhaPdf, segmentos, largura, zoom, ascendentes, publicar]);

  // Trechos novos sobre a camada já desenhada: só as marcas mudam.
  useEffect(() => {
    if (!camadaPronta.current || !aplicarMarcas()) return;
    medirOGrifo();
  }, [aplicarMarcas, medirOGrifo]);

  // Rola até o grifo quando ele chega (página, trecho, zoom) — pela primeira faixa, estimada ou exata.
  const chaveDaRolagem = `${page}|${needle}|${zoom}|${largura}`;
  useEffect(() => {
    if (!desenho || desenho.chave !== chaveDoDesenho || !desenho.grupos.some((g) => g.grifo === 0)) return;
    if (ultimoRolado.current === chaveDaRolagem) return;
    ultimoRolado.current = chaveDaRolagem;
    rolarAteOGrifo();
  }, [desenho, chaveDoDesenho, chaveDaRolagem, rolarAteOGrifo]);

  // O aviso da camada desenhada é ESTÁVEL: ele também está nas dependências do
  // efeito que desenha a camada, e um aviso novo a cada render a redesenharia.
  const aoPintar = useRef(() => {});
  useEffect(() => {
    aoPintar.current = () => {
      camadaPronta.current = true;
      if (aplicarMarcas()) medirOGrifo();
    };
  });
  const aoPintarOTexto = useCallback(() => aoPintar.current(), []);

  // O resultado do casamento sobe uma vez por página lida (e por trecho).
  useEffect(() => {
    if (!onGrifo || !itens || paginaDosItens !== page || needle.length < 3) return;
    onGrifo(Boolean(faixas && faixas.size > 0), page);
  }, [onGrifo, itens, paginaDosItens, page, needle, faixas]);

  /*
   * O BALÃO SE ARRASTA (15/10/2026). Preso ao trecho ele cobria justamente as
   * linhas de baixo, que às vezes são o resto da prova. Arrastado, fica onde a
   * pessoa largou até o grifo mudar (outro achado, outra página); duplo clique
   * na alça devolve ao trecho. Arrastar exige 4 px: menos que isso é clique, e
   * o clique da pílula continua abrindo o balão.
   */
  const [arrasto, setArrasto] = useState<{ chave: string; dx: number; dy: number } | null>(null);
  const acabouDeArrastar = useRef(false);
  // A chave junta o grifo e o "volta" do dono: mudou qualquer um, o desvio caduca.
  const chaveDoArrasto = `${chaveDoDesenho}|${voltaDoBalao ?? 0}`;
  const desvio = arrasto && arrasto.chave === chaveDoArrasto ? arrasto : null;
  /*
   * O movimento é ouvido na JANELA: o primeiro passo do mouse já sai da pílula
   * (28 px de altura), e o balão não ouviria o resto. Captura de ponteiro
   * resolveria, mas mudaria o alvo do clique — e a pílula deixaria de abrir.
   */
  const pegarOBalao = (e: EventoDePonteiro<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // O texto do balão aberto se seleciona; só a alça (topo e pílula) arrasta.
    if (!(e.target as HTMLElement).closest("[data-alca]")) return;
    const folha = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!folha) return;
    e.preventDefault();
    const caixa = e.currentTarget.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const dx0 = desvio?.dx ?? 0;
    const dy0 = desvio?.dy ?? 0;
    const chave = chaveDoArrasto;
    let moveu = false;
    const mover = (ev: PointerEvent) => {
      let mx = ev.clientX - x0;
      let my = ev.clientY - y0;
      if (!moveu && Math.hypot(mx, my) < 4) return;
      moveu = true;
      // Dentro da folha: um balão fora da página não tem como ser pego de volta.
      mx = Math.max(folha.left - caixa.left, Math.min(mx, folha.right - caixa.right));
      my = Math.max(folha.top - caixa.top, Math.min(my, folha.bottom - caixa.bottom));
      setArrasto({ chave, dx: dx0 + mx, dy: dy0 + my });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (!moveu) return;
      // O clique que fecha um arrasto não é clique; se ele não vier, a trava cai sozinha.
      acabouDeArrastar.current = true;
      setTimeout(() => (acabouDeArrastar.current = false), 0);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  // Onde o balão encosta: as linhas do grifo ativo, já medidas.
  const linhasDoAtivo = desenho && desenho.chave === chaveDoDesenho ? desenho.grupos.find((g) => g.grifo === 0)?.faixas : undefined;
  const lugarDoBalao = (() => {
    if (!balao || !desenho || !linhasDoAtivo?.length) return null;
    const primeira = linhasDoAtivo[0];
    const ultima = linhasDoAtivo[linhasDoAtivo.length - 1];
    const largura = Math.min(LARGURA_DO_BALAO, desenho.largura - 16);
    const left = Math.max(8, Math.min(primeira.x, desenho.largura - largura - 8));
    // No terço de baixo da folha, o balão abre para cima: aberto, ele não cabe embaixo.
    const acima = ultima.y + ultima.h > desenho.altura * 0.68;
    const estilo: CSSProperties & Record<`--${string}`, string> = {
      left,
      maxWidth: largura,
      ...(acima ? { bottom: desenho.altura - primeira.y + 8 } : { top: ultima.y + ultima.h + 8 }),
      "--grifo-balao-seta": `${Math.max(10, Math.min(primeira.x - left + 10, largura - 24))}px`,
    };
    return { acima, estilo };
  })();

  /*
   * OS PINOS NA MARGEM: um por achado grifado nesta folha, na altura da
   * primeira linha dele. O do ativo é cheio; os outros, contorno. Clicar num
   * deles torna aquele achado o ativo — a lista ao lado acende junto.
   */
  const pinos =
    desenho && desenho.chave === chaveDoDesenho && pinoDoAtivo && onEscolher
      ? (() => {
          const quem = (g: number) => (g === 0 ? { ...pinoDoAtivo, tom } : outros?.[g - 1]);
          const primeiras = desenho.grupos.filter((gr) => gr.faixas.length && quem(gr.grifo)).map((gr) => ({ grifo: gr.grifo, y: gr.faixas[0].y + gr.faixas[0].h / 2 - TAMANHO_DO_PINO / 2 }));
          const alturas = alturasDosPinos(primeiras, TAMANHO_DO_PINO);
          return primeiras.map(({ grifo }) => ({ grifo, y: alturas.get(grifo) ?? 0, ...quem(grifo)! }));
        })()
      : [];

  const safePage = numPages > 0 ? Math.min(Math.max(1, page), numPages) : Math.max(1, page);

  return (
    <div ref={caixa} className="contents" data-grifo-tom={tom}>
    {pdf === null ? (
      <div className="p-3">
        <Skeleton className="mx-auto h-[70vh] w-full max-w-[560px]" />
      </div>
    ) : pdf === false ? (
      <div className="p-6 text-sm text-muted-foreground">
        Não foi possível abrir o PDF nesta sessão.
      </div>
    ) : (
    <div className="flex flex-col items-center">
      <Page
        pdf={pdf}
        pageNumber={safePage}
        onLoadSuccess={(folha) => setFolhaPdf({ numero: folha.pageNumber, pagina: folha })}
        width={Math.round(largura * zoom)}
        onGetTextSuccess={(conteudo) => {
          /*
           * `TextMarkedContent` vem misturado aos itens de texto e não tem
           * `str` — o predicado o descarta. O `unknown` no meio é por causa do
           * `dir`/`fontName` do tipo do pdf.js, que `ItemDeTexto` não declara
           * de propósito: ele é o SUBCONJUNTO que a costura usa, e é o que
           * mantém o módulo puro provável sem pdf.js.
           */
          const lidos = (conteudo?.items ?? []).filter(
            (item) => typeof (item as { str?: unknown }).str === "string",
          ) as unknown as ItemDeTexto[];
          setItens(lidos);
          setPaginaDosItens(safePage);
          const estilos = (conteudo as { styles?: Record<string, { ascent?: number; descent?: number }> }).styles ?? {};
          setAscendentes(Object.fromEntries(Object.entries(estilos).map(([nome, e]) => [nome, e.ascent ? e.ascent : e.descent ? 1 + e.descent : 0.8])));
        }}
        onRenderTextLayerSuccess={aoPintarOTexto}
        renderAnnotationLayer={false}
        className="shadow-sm"
      >
        {desenho && desenho.chave === chaveDoDesenho && (
          <div className="grifo-faixas" aria-hidden>
            {desenho.grupos.flatMap(({ grifo, faixas: doGrifo }) => {
              const dono = grifo === 0 ? { chave: pinoDoAtivo?.chave, tom } : outros?.[grifo - 1];
              const classe = [
                "grifo-faixa",
                grifo === 0 ? "grifo-faixa--ativo" : "grifo-faixa--outro",
                grifo === 0 && desenho.pintar ? "grifo-faixa--pinta" : "",
                dono?.chave && realce === dono.chave ? "grifo-faixa--realce" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return doGrifo.map((r, i) => (
                <span
                  key={`${grifo}:${i}`}
                  className={classe}
                  data-tom={dono?.tom}
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h, animationDelay: `${40 + i * 60}ms` }}
                />
              ));
            })}
          </div>
        )}
        {lugarDoBalao && (
          <div
            className={`grifo-balao grifo-balao--${lugarDoBalao.acima ? "acima" : "abaixo"}${desvio ? " grifo-balao--solto" : ""}`}
            data-tom={tom}
            style={{ ...lugarDoBalao.estilo, // `transform`, não `translate`: a animação de entrada anima `translate` com
              // fill-mode both, e venceria o inline.
              ...(desvio ? { transform: `translate(${desvio.dx}px, ${desvio.dy}px)` } : {}) }}
            onPointerDown={pegarOBalao}
            onClickCapture={(e) => {
              // O clique que fecha um arrasto não é clique: não abre nem recolhe.
              if (acabouDeArrastar.current) {
                acabouDeArrastar.current = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-alca]")) setArrasto(null);
            }}
          >
            {balao}
          </div>
        )}
        {pinos.length > 0 && (
          <div className="grifo-pinos">
            {pinos.map((p) => (
              <button
                key={p.chave}
                type="button"
                className={`grifo-pino${p.grifo === 0 ? " grifo-pino--ativo" : ""}${realce === p.chave ? " grifo-pino--realce" : ""}`}
                data-tom={p.tom}
                style={{ top: p.y }}
                title={p.titulo}
                aria-label={p.grifo === 0 ? `${p.titulo} (aberto)` : `Abrir ${p.titulo}`}
                aria-pressed={p.grifo === 0}
                onClick={() => p.grifo !== 0 && onEscolher?.(p.chave)}
                onMouseEnter={() => onRealce?.(p.chave)}
                onMouseLeave={() => onRealce?.(null)}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        )}
      </Page>
    </div>
    )}
    </div>
  );
}
