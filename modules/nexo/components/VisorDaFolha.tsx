"use client";

/**
 * O VISOR DA FOLHA, em MODO SELO.
 *
 * Abrir uma prancha abria uma aba do navegador com o PDF inteiro — e aí começava
 * o trabalho: achar o carimbo no canto inferior direito de uma A0, dar zoom,
 * conferir, voltar, repetir. Numa A0 de 2384×1684 o carimbo é ~4% da área. É o
 * gesto mais repetido do produto e o único que o software podia ter poupado
 * desde o começo.
 *
 * Aqui a folha ABRE JÁ NO CARIMBO, e as setas andam folha a folha MANTENDO o
 * enquadramento — que é o que transforma conferir um lote inteiro numa sequência
 * de olhadas, em vez de uma sequência de navegações.
 *
 * A CAIXA NÃO É CHUTADA. Vem de `analisarPagina`, a mesma função que mede o
 * carimbo para o recorte enviado ao modelo. Se o olho humano enquadrasse um
 * pedaço de papel diferente daquele de onde saíram os dados, a conferência
 * estaria julgando outra coisa — e é determinística, então não custa token
 * nenhum.
 *
 * O ENQUADRAMENTO É TRANSFORM, NÃO RECORTE: o texto continua selecionável, o
 * pdfjs continua rasterizando na resolução da página, e sair do modo selo é
 * trocar dois números.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Maximize2, Stamp, X } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PAGINA_INTEIRA,
  enquadrarSelo,
  type CaixaNormalizada,
  type Enquadramento,
} from "../lib/enquadramento-do-selo";
import { analisarPagina } from "../lib/selo-render";

import "react-pdf/dist/Page/TextLayer.css";

// Mesmo worker do visor da auditoria, e pelo mesmo motivo: a versão do pdfjs
// tem de casar com a que o react-pdf traz aninhada, senão nada renderiza.
pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/pdf.worker.react-pdf.mjs";

/** Uma folha navegável: o que o visor precisa para abrir e para se rotular. */
export interface FolhaNoVisor {
  id: string;
  /**
   * Os bytes, não a URL. Quem exibe é quem cria e revoga o blob — o dono não
   * pode criar object URL num `useMemo` sem vazar uma a cada recálculo.
   */
  file: File;
  pageNumber: number;
  /** `07`, `12` — o que o carimbo diz. Vazio quando a leitura falhou. */
  numero?: string;
  titulo?: string;
  sigla?: string;
  fileName: string;
}

const LARGURA_BASE = 1100;

export function VisorDaFolha({
  folhas,
  indiceInicial,
  onFechar,
}: {
  folhas: FolhaNoVisor[];
  indiceInicial: number;
  onFechar: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [modoSelo, setModoSelo] = useState(true);
  const [caixa, setCaixa] = useState<CaixaNormalizada | null>(null);
  const [pagina, setPagina] = useState<{ largura: number; altura: number } | null>(
    null,
  );
  const [quadro, setQuadro] = useState({ largura: 0, altura: 0 });
  const quadroRef = useRef<HTMLDivElement>(null);

  const folha = folhas[indice];

  /*
   * A OBJECT URL DA FOLHA ATUAL, criada e revogada aqui.
   *
   * Uma por vez: o visor mostra uma folha, e manter vinte blobs vivos porque o
   * lote tem vinte folhas é segurar vinte PDFs na memória para exibir um. O
   * `revoke` no cleanup é o que fecha a torneira ao andar com as setas.
   */
  const [url, setUrl] = useState<string | null>(null);
  const arquivo = folha?.file;
  useEffect(() => {
    if (!arquivo) return;
    const nova = URL.createObjectURL(arquivo);
    // O `setState` é adiado num rAF: síncrono no corpo do efeito, ele é render
    // em cascata, e o lint do React Compiler barra. Mesmo padrão que
    // `use-agent-state.ts` e a espera do orbe usam. O custo é um quadro — o
    // esqueleto do PDF já está na tela nele.
    const raf = requestAnimationFrame(() => setUrl(nova));
    return () => {
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(nova);
    };
  }, [arquivo]);

  const irPara = useCallback(
    (delta: number) => {
      setIndice((i) => {
        const proximo = i + delta;
        if (proximo < 0 || proximo >= folhas.length) return i;
        /*
         * A caixa zera a cada folha, mas o MODO não: quem entrou no modo selo
         * quer conferir o lote inteiro no carimbo. Zerar o modo a cada seta
         * transformaria a navegação em vinte cliques de reenquadramento.
         */
        setCaixa(null);
        setPagina(null);
        return proximo;
      });
    },
    [folhas.length],
  );

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") irPara(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") irPara(-1);
      else if (e.key.toLowerCase() === "s") setModoSelo((m) => !m);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [irPara, onFechar]);

  // O quadro é medido, não suposto: o enquadramento depende do tamanho real da
  // caixa na tela, e ela muda com a janela.
  useEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entrada]) => {
      const r = entrada.contentRect;
      setQuadro({ largura: r.width, altura: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * A medição roda no `onLoadSuccess` da PÁGINA, e não do documento: é ali que
   * o objeto de página do pdfjs existe, e é ele que `analisarPagina` recebe.
   * Falhar aqui NÃO é erro de tela — cai na página inteira, que é a leitura de
   * reserva honesta ("não sei onde está o carimbo, veja a folha").
   */
  const aoCarregarPagina = useCallback(async (page: unknown) => {
    const p = page as {
      getViewport: (o: { scale: number }) => { width: number; height: number };
    };
    const vp = p.getViewport({ scale: 1 });
    setPagina({ largura: vp.width, altura: vp.height });
    try {
      const { caixa: medida } = await analisarPagina(page as never);
      setCaixa(medida);
    } catch {
      setCaixa(null);
    }
  }, []);

  const enquadramento: Enquadramento = useMemo(() => {
    if (!modoSelo || !caixa || !pagina) return PAGINA_INTEIRA;
    // A página é renderizada com largura fixa; a altura vem da proporção real.
    const escalaDoRender = LARGURA_BASE / pagina.largura;
    return enquadrarSelo(
      caixa,
      {
        largura: pagina.largura * escalaDoRender,
        altura: pagina.altura * escalaDoRender,
      },
      quadro,
    );
  }, [modoSelo, caixa, pagina, quadro]);

  const semGeometria = modoSelo && pagina !== null && caixa === null;

  if (!folha) return null;

  const rotulo = [folha.sigla, folha.numero && `folha ${folha.numero}`, folha.titulo]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Folha ${folha.numero ?? ""} — ${folha.fileName}`}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--nexodoc-recessed)]/95"
    >
      {/* CROMO: o que se está vendo, e como sair. Mono, como todo dado. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <Stamp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-[0.02em]">
          {rotulo || folha.fileName}
        </p>
        <p className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {indice + 1}/{folhas.length}
        </p>

        <button
          type="button"
          onClick={() => setModoSelo((m) => !m)}
          aria-pressed={modoSelo}
          className={cn(
            "nx-edge-6 flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
            modoSelo
              ? "text-[var(--primary)] [--nx-edge:var(--primary)] [--nx-fill:transparent]"
              : "text-muted-foreground [--nx-edge:var(--border)] [--nx-fill:transparent] hover:text-foreground",
          )}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          {modoSelo ? "selo" : "folha inteira"}
        </button>

        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar o visor"
          className="nx-edge-6 flex size-8 items-center justify-center text-muted-foreground transition-colors [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <Seta
          lado="esquerda"
          desabilitada={indice === 0}
          onClick={() => irPara(-1)}
        />

        <div ref={quadroRef} className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${enquadramento.x}px, ${enquadramento.y}px) scale(${enquadramento.escala})`,
              // A transição só existe DENTRO da mesma folha (entrar e sair do
              // modo selo). Entre folhas o enquadramento nasce zerado, e animar
              // do nada até o carimbo seria movimento sem significado.
              transition: "transform var(--duration-slow) var(--ease-entrance)",
            }}
          >
            <Document
              key={url ?? "sem-url"}
              file={url ?? undefined}
              loading={
                <div className="p-6">
                  <Skeleton className="h-[70vh] w-[560px]" />
                </div>
              }
              error={
                <p className="p-6 text-sm text-muted-foreground">
                  Não foi possível abrir esta folha nesta sessão.
                </p>
              }
            >
              <Page
                pageNumber={folha.pageNumber}
                width={LARGURA_BASE}
                onLoadSuccess={aoCarregarPagina}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        </div>

        <Seta
          lado="direita"
          desabilitada={indice === folhas.length - 1}
          onClick={() => irPara(1)}
        />
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
        <span>
          ← → folha · S alterna selo · Esc fecha
        </span>
        {/*
          AUSÊNCIA NUNCA VIRA CONFLITO (princípio 1). Não achar o carimbo não é
          um erro da folha nem do software: é um fato sobre o arquivo, e o que
          se faz a respeito é olhar a folha inteira — que é o que já está na
          tela quando isto aparece.
        */}
        {semGeometria && (
          <span className="text-[var(--signal-info)]">
            carimbo não localizado nesta folha — mostrando a página inteira
          </span>
        )}
      </footer>
    </div>
  );
}

function Seta({
  lado,
  desabilitada,
  onClick,
}: {
  lado: "esquerda" | "direita";
  desabilitada: boolean;
  onClick: () => void;
}) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitada}
      aria-label={lado === "esquerda" ? "Folha anterior" : "Próxima folha"}
      className="flex w-12 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
    >
      <Icone className="size-6" aria-hidden />
    </button>
  );
}
