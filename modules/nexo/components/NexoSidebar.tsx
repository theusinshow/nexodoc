"use client";

/**
 * Sidebar cheia do Nexo (v2). Topo = marca; meio = Nova conversa + BUSCA +
 * FILTRO + Histórico em DUAS SEÇÕES (montagem de volumes / auditoria de
 * memoriais), cada uma com as suas pastas por obra; base = fileira de ícones +
 * bloco da conta. Matte, calma (superfície de leitura). Persistência real
 * (IndexedDB).
 *
 * TRÊS MUDANÇAS SOBRE A v1, e a razão de cada uma:
 *
 * 1. DUAS SEÇÕES. A lista misturava os dois trabalhos: uma conversa que montou
 *    um volume e uma que auditou um memorial eram a mesma linha cinza. O tipo
 *    vem de `ConversationSummary.tipo`, derivado do que a conversa produziu —
 *    ninguém escolhe nada na frente.
 * 2. FILTRO DE TRÊS ESTADOS. Ele esconde a SEÇÃO INTEIRA, não filtra item a
 *    item. As contagens ao lado do rótulo são do total de cada tipo e não mudam
 *    ao filtrar: é assim que se vê que existe trabalho do outro lado.
 * 3. ESCALA. Toda a coluna sobe um degrau, com piso de 11,5px. A v1 desenhava
 *    título a 12px e hora a 11px numa coluna de 240px — era daí que vinha a
 *    sensação de ilegível. A coluna vai a 300px (`--nexo-sidebar-w`) para o
 *    título maior não truncar em cinco caracteres.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudOff,
  Compass,
  CopyPlus,
  FileSearch,
  FolderKanban,
  Gauge,
  Layers,
  Plus,
  Search,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { SignOutMenuItem } from "@/components/sign-out-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConversationSummary, TipoDeTrabalho } from "../lib/nexo-db";
import type { EstadoDaSincronizacao } from "../lib/nexo-sync";
import { contarPorTipo, groupConversations } from "../lib/group-conversations";
import { MarcaViva } from "@/components/brand/marca-viva";

/** Data curta pt-BR (hoje → hora; senão → dd/mm). Sem libs. */
function shortDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Os três estados do filtro. "tudo" mostra as duas seções. */
type Filtro = "tudo" | TipoDeTrabalho;

const FILTROS: readonly Filtro[] = ["tudo", "volume", "auditoria"] as const;

const ROTULO_DO_FILTRO: Record<Filtro, string> = {
  tudo: "Tudo",
  volume: "Volumes",
  auditoria: "Auditorias",
};

/**
 * O filtro PERSISTE. Quem só audita não reescolhe o recorte toda manhã, e
 * "tudo" a cada carregamento apaga uma decisão que a pessoa já tomou. Mesmo
 * armazenamento local do resto da barra (ver `nexo:copilot-w`).
 */
const CHAVE_FILTRO = "nexo:sidebar-filtro";

function ehFiltro(v: unknown): v is Filtro {
  return v === "tudo" || v === "volume" || v === "auditoria";
}

/** As duas seções, na ordem em que aparecem. */
const SECOES: {
  tipo: TipoDeTrabalho;
  titulo: string;
  Icone: typeof Layers;
  marca: string;
  /** O que cai aqui, dito para a seção vazia. */
  vazio: string;
}[] = [
  {
    tipo: "volume",
    titulo: "Montagem de volumes",
    Icone: Layers,
    marca: "var(--nexo-marca-volume)",
    vazio: "Volumes montados aparecem aqui.",
  },
  {
    tipo: "auditoria",
    titulo: "Auditoria de memoriais",
    Icone: FileSearch,
    marca: "var(--nexo-marca-auditoria)",
    vazio: "Memoriais auditados aparecem aqui.",
  },
];

/** Iniciais do nome, no máximo duas. "Marcos Ribeiro" → "MR". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

export function NexoSidebar({
  onNewConversation,
  conversations = [],
  activeId,
  onSelect,
  onDelete,
  onDeleteFolder,
  onDuplicate,
  isAdmin = false,
  onVerTour,
  onPreferencias,
  nome,
  email,
  trabalhando = false,
  sincronizacao,
}: {
  onNewConversation?: () => void;
  conversations?: ConversationSummary[];
  /** Última ida ao servidor. Só desenha algo quando falhou. */
  sincronizacao?: EstadoDaSincronizacao;
  activeId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  /**
   * Apaga uma PASTA inteira. Recebe os ids do grupo que a barra desenhou —
   * exatamente os que estão à vista, e não uma chave para o dono reconsultar:
   * o mesmo código de obra existe nas duas seções, e apagar por chave levaria
   * junto a auditoria que ninguém mandou apagar.
   */
  onDeleteFolder?: (ids: string[]) => void;
  /** Nova conversa a partir de uma existente (leva os selos, não a história). */
  onDuplicate?: (id: string) => void;
  /** Mostra o painel admin no rodapé. Vem da sessão, no server. */
  isAdmin?: boolean;
  /** Reabre o passo a passo guiado. Ausente = a entrada não aparece. */
  onVerTour?: () => void | Promise<void>;
  /**
   * Abre as preferências. Ausente = o item não aparece no menu da conta.
   *
   * Mesmo padrão de `onVerTour`, e pela mesma razão: não existe tela de
   * preferências ainda, e um item de menu que não leva a lugar nenhum é pior
   * que a ausência dele.
   */
  onPreferencias?: () => void | Promise<void>;
  /** Nome da sessão. Sem ele, o bloco da conta não renderiza. */
  nome?: string | null;
  /** E-mail da sessão, em mono truncado sob o nome. */
  email?: string | null;
  /**
   * O agente está trabalhando (lendo selos, pensando, respondendo, auditando).
   * A marca respira enquanto isso — é o único movimento contínuo daqui, e ele
   * significa estado, não decoração.
   */
  trabalhando?: boolean;
}) {
  const [query, setQuery] = useState("");
  /**
   * O que aguarda confirmação de exclusão — UMA por vez, conversa ou pasta.
   *
   * O tipo entra na chave porque as duas confirmações dividem o mesmo estado:
   * armar a pasta desarma o item, e vice-versa. Duas perguntas abertas ao mesmo
   * tempo numa coluna estreita seriam duas chances de clicar na errada.
   */
  const [confirmando, setConfirmando] = useState<{
    tipo: "conversa" | "pasta";
    id: string;
  } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  /** Seções recolhidas à mão. Ausente do conjunto = aberta. */
  const [recolhidas, setRecolhidas] = useState<Set<TipoDeTrabalho>>(
    () => new Set(),
  );

  /*
   * Lê a preferência DEPOIS de montar: no servidor não existe `localStorage`, e
   * ler no primeiro render faria o HTML do servidor divergir do cliente
   * (hidratação). Mesmo padrão do ShellSplitter.
   */
  useEffect(() => {
    let salvo: string | null = null;
    try {
      salvo = window.localStorage.getItem(CHAVE_FILTRO);
    } catch {
      // Armazenamento bloqueado (modo privado, política de site). O filtro
      // funciona igual, só não sobrevive ao recarregar — nada a dizer na tela.
    }
    if (!ehFiltro(salvo)) return;
    // Um quadro depois, como o ShellSplitter faz com a largura do copiloto:
    // `setState` síncrono dentro do efeito cascateia render (React Compiler).
    const raf = requestAnimationFrame(() => setFiltro(salvo));
    return () => cancelAnimationFrame(raf);
  }, []);

  const escolherFiltro = useCallback((f: Filtro) => {
    setFiltro(f);
    try {
      window.localStorage.setItem(CHAVE_FILTRO, f);
    } catch {
      // Ver acima.
    }
  }, []);

  /** Contagem por tipo: a lista INTEIRA, sem busca e sem filtro. */
  const contagem = useMemo(() => contarPorTipo(conversations), [conversations]);

  /** As pastas de cada seção, já recortadas por tipo e pela busca. */
  const gruposPorTipo = useMemo(
    () => ({
      volume: groupConversations(conversations, query, "volume"),
      auditoria: groupConversations(conversations, query, "auditoria"),
    }),
    [conversations, query],
  );

  const secoesVisiveis = SECOES.filter(
    (s) => filtro === "tudo" || s.tipo === filtro,
  );
  const empty = conversations.length === 0;
  const achou = secoesVisiveis.some((s) => gruposPorTipo[s.tipo].length > 0);
  const noMatch = !empty && query.trim() !== "" && !achou;

  /*
   * SETAS ←/→ NAVEGAM O FILTRO.
   *
   * `role="tablist"` promete isso a quem usa teclado, e prometer sem cumprir é
   * pior que não ter papel nenhum. Move o foco E a seleção juntos, que é o
   * comportamento de tablist de seleção automática.
   */
  const trilhoRef = useRef<HTMLDivElement>(null);
  const navegarPorTeclado = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (passo === 0) return;
      e.preventDefault();
      const i = FILTROS.indexOf(filtro);
      const proximo = FILTROS[(i + passo + FILTROS.length) % FILTROS.length];
      escolherFiltro(proximo);
      trilhoRef.current
        ?.querySelector<HTMLButtonElement>(`[data-filtro="${proximo}"]`)
        ?.focus();
    },
    [filtro, escolherFiltro],
  );

  const alternarSecao = useCallback((tipo: TipoDeTrabalho) => {
    setRecolhidas((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }, []);

  return (
    <aside
      aria-label="Navegação do Nexo"
      className="flex h-full w-full flex-col gap-3 border-r border-border/60 p-3.5"
    >
      {/*
        Topo: a marca. Não há mais "voltar" — a entrada do software é esta tela.
        E ela DIZ O QUE O AGENTE ESTÁ FAZENDO.

        A §6 é clara: "em repouso ela fica PARADA; marca que se mexe sozinha
        vira decoração". Um laço permanente aqui seria isso. Mas o orbe é a
        presença do agente, e movimento que carrega ESTADO é o trabalho dele,
        não enfeite — a mesma regra da §5.

        Vale mais aqui do que no palco: a barra lateral está sempre visível,
        enquanto o orbe grande sai de vista quando se rola a conversa ou se olha
        o canvas. Trabalhando, ela respira; parada, fica parada.
      */}
      <div className="flex items-center gap-2.5 px-1 py-1">
        <span
          className={cn("inline-flex", trabalhando && "nexodoc-status-pulse")}
          title={trabalhando ? "O Nexo está trabalhando" : undefined}
        >
          <MarcaViva size={20} />
        </span>
        <span className="font-mono text-[15px] font-semibold tracking-[-0.01em]">
          Nexo
        </span>
        {/* O que ele está fazendo, em texto — movimento nunca carrega
            significado sozinho (§5, acessibilidade). */}
        {trabalhando && (
          <span className="sr-only" role="status">
            O Nexo está trabalhando
          </span>
        )}
      </div>

      {/*
        Nova conversa: UMA ENTRADA SÓ, e primária.

        Duas portas ("Montar" / "Auditar") foram consideradas e recusadas: quem
        chega não sabe ainda em qual dos dois trabalhos vai cair, e escolher
        errado na porta é um erro que a pessoa carrega até o fim. O tipo é
        decidido pelo que se anexa, depois.
      */}
      <Button
        type="button"
        size="lg"
        onClick={onNewConversation}
        className="w-full justify-start gap-2.5 px-3.5 text-[12.5px]"
      >
        <Plus className="shrink-0" strokeWidth={1.9} aria-hidden />
        Nova conversa
      </Button>

      {/* Busca */}
      {!empty && (
        <div className="relative">
          <Search
            /* z-10: o wrapper do campo vem DEPOIS no DOM e tambem e posicionado,
               entao sem isto ele pinta por cima da lupa e ela some. */
            className="pointer-events-none absolute left-3 top-[11px] z-10 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          {/* Wrapper pela mesma razao do primitivo Input: campo nativo nao
              renderiza ::before, entao a camada de contorno mora fora. */}
          <div className="nx-edge-7 h-[38px] w-full [--nx-edge:var(--nexodoc-recessed)] [--nx-fill:var(--nexodoc-recessed)]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              /* O placeholder DIZ O QUE A BUSCA COBRE. Só "buscar" faz o
                 engenheiro que não achou duvidar se digitou errado, quando o
                 problema pode ser o campo que a busca não alcança. */
              placeholder="Buscar obra ou código…"
              aria-label="Buscar conversas por obra ou código"
              className="size-full border-0 bg-transparent pl-9 pr-3 font-mono text-[12.5px] text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/*
        O FILTRO.

        Ele esconde a seção INTEIRA — não filtra item a item. Em "Volumes" a
        seção de auditoria não aparece, e é essa a diferença entre um recorte e
        uma lista peneirada: a estrutura da coluna muda, não só o conteúdo dela.

        Os números são a contagem TOTAL de cada tipo e não mudam ao filtrar. Um
        contador que zera junto com a seção que ele descreve não informa nada; o
        que informa é "existe trabalho do outro lado".
      */}
      {!empty && (
        <div
          ref={trilhoRef}
          role="tablist"
          aria-label="Filtrar histórico por tipo de trabalho"
          onKeyDown={navegarPorTeclado}
          className="nx-cut-7 grid grid-cols-3 gap-0.5 border-0 bg-[var(--nexodoc-recessed)] p-[3px]"
        >
          {FILTROS.map((f) => {
            const ativo = filtro === f;
            const n =
              f === "tudo"
                ? contagem.tudo
                : f === "volume"
                  ? contagem.volume
                  : contagem.auditoria;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                data-filtro={f}
                aria-selected={ativo}
                aria-controls="nexo-historico"
                /* Só o ativo entra na ordem de tabulação; as setas alcançam os
                   outros. É o padrão de tablist, e evita três paradas de Tab
                   numa fileira que decide uma coisa só. */
                tabIndex={ativo ? 0 : -1}
                onClick={() => escolherFiltro(f)}
                className={cn(
                  "nx-edge-6 flex h-[30px] items-center justify-center gap-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.04em] transition-colors duration-[var(--duration-fast)] focus-visible:outline-none [--nx-edge:transparent]",
                  ativo
                    ? "text-[var(--primary)] [--nx-fill:var(--accent)]"
                    : "text-muted-foreground [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]",
                )}
              >
                {ROTULO_DO_FILTRO[f]}
                <span
                  className={cn(
                    "text-[11.5px] tabular-nums",
                    ativo
                      ? "text-[var(--nexodoc-accent)]"
                      : "text-muted-foreground/70",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Histórico: duas seções, e dentro de cada uma as pastas por obra */}
      <div
        id="nexo-historico"
        role="tabpanel"
        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto"
      >
        {empty && (
          /*
           * ESTADO VAZIO conforme a DESIGN.md §7: um Mono Label nomeando a
           * região e uma linha dizendo o que vai aparecer ali. Sem ação —
           * aqui não há nada a fazer, e ação inventada num vazio é confissão
           * de que a tela não sabe o que quer.
           *
           * Sem conversa nenhuma, some TUDO entre a busca e o rodapé: sem
           * filtro, sem seções. Filtrar o nada e recolher o vazio são gestos
           * que não servem a ninguém.
           */
          /* Raio de 4px, nao chanfro: tracejado nao sobrevive ao recorte (a
             borda sumiria nas duas diagonais). Mesmo tratamento que a spec da
             aos campos tracejados do carimbo. */
          <div className="space-y-1.5 rounded-[4px] border border-dashed border-border/60 px-3 py-3">
            <p className="font-mono text-[11.5px] uppercase tracking-[0.07em] text-muted-foreground">
              Histórico
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Suas conversas e volumes ficam salvos aqui.
            </p>
          </div>
        )}
        {noMatch && (
          /* Diz ONDE buscou, e SOB QUAL RECORTE. Só "nada encontrado" faz o
             engenheiro duvidar se digitou errado, quando o problema pode ser o
             filtro ativo escondendo justamente a seção que tem o resultado. */
          <p className="px-2 py-3 text-center text-[11.5px] leading-5 text-muted-foreground">
            {filtro === "tudo"
              ? `Nenhuma conversa com “${query}”.`
              : `Nenhuma ${filtro === "volume" ? "montagem" : "auditoria"} com “${query}”.`}
            <br />A busca cobre o título da obra e o código do projeto.
          </p>
        )}
        {!empty &&
          !noMatch &&
          secoesVisiveis.map((s) => {
            const grupos = gruposPorTipo[s.tipo];
            const total =
              s.tipo === "volume" ? contagem.volume : contagem.auditoria;
            /*
             * A ÚNICA SEÇÃO VISÍVEL NÃO RECOLHE. Recolher a única lista da tela
             * deixaria a coluna inteira vazia sem dizer por quê — um gesto que
             * só produz um estado pior que o anterior.
             */
            const podeRecolher = secoesVisiveis.length > 1;
            const recolhida = podeRecolher && recolhidas.has(s.tipo);
            const Cabecalho = podeRecolher ? "button" : "div";
            return (
              <div key={s.tipo} className="flex flex-col gap-1">
                <Cabecalho
                  {...(podeRecolher
                    ? {
                        type: "button" as const,
                        onClick: () => alternarSecao(s.tipo),
                        "aria-expanded": !recolhida,
                      }
                    : {})}
                  className={cn(
                    "nx-edge-6 flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:var(--nexodoc-recessed)]",
                    podeRecolher &&
                      "cursor-pointer hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]",
                  )}
                >
                  {/* O ícone teal mora no CABEÇALHO, que é o que se clica —
                      dentro da lista o tipo já está dito pela seção. */}
                  <s.Icone
                    className="h-[15px] w-[15px] shrink-0 text-[var(--nexodoc-accent)]"
                    strokeWidth={1.6}
                    aria-hidden
                  />
                  <span className="flex-1 font-mono text-xs font-semibold uppercase tracking-[0.05em] text-foreground">
                    {s.titulo}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {total}
                  </span>
                  {podeRecolher && (
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
                        !recolhida && "rotate-90",
                      )}
                      strokeWidth={1.6}
                      aria-hidden
                    />
                  )}
                </Cabecalho>

                {/*
                  SEÇÃO VAZIA continua com cabeçalho e contagem 0, mais uma
                  linha dizendo o que cai ali. Some só quando não há conversa
                  nenhuma — uma seção que desaparece quando esvazia esconde
                  metade do software de quem ainda não usou essa metade.
                */}
                {!recolhida && grupos.length === 0 && (
                  <p className="px-2.5 py-2 text-[11.5px] leading-5 text-muted-foreground/80">
                    {s.vazio}
                  </p>
                )}

                {!recolhida &&
                  grupos.map((g) => {
                    /*
                     * A pasta só existe DENTRO da seção: o mesmo código de obra
                     * aparece em montagem e em auditoria, e as duas são pastas
                     * diferentes para quem trabalha. Por isso a chave da
                     * confirmação leva o tipo junto.
                     */
                    const idDaPasta = `${s.tipo}:${g.key ?? "__none__"}`;
                    const confirmandoPasta =
                      confirmando?.tipo === "pasta" && confirmando.id === idDaPasta;
                    return (
                    <details key={g.key ?? "__none__"} open className="group/f">
                      {/*
                        A pasta é o CÓDIGO DA OBRA, e é por ele que se procura.
                        Sai em Mono Label maiúsculo — o degrau que a §3 reserva
                        para rótulo de região —, e o ícone de pasta saiu: o
                        chevron e o recuo já dizem que é um grupo, e dois glifos
                        para o mesmo trabalho é ruído numa coluna estreita.
                      */}
                      {/* `.nx-edge-5` com tokens transparentes: sem forma em
                          repouso, mas com o anel de foco POR DENTRO de graca.
                          `.nx-cut-*` sozinho desligaria o ring global sem por
                          nada no lugar, e um focalizavel sem foco visivel e
                          regressao de acessibilidade. */}
                      <summary
                        /*
                         * `group/s` é do SUMMARY, não do `<details>`: com
                         * `group-hover/f` os botões da pasta apareciam ao passar
                         * o ponteiro por qualquer conversa lá de dentro.
                         *
                         * Confirmando, o clique não pode dobrar a pasta — a
                         * pergunta mora aqui dentro, e recolher o grupo a
                         * levaria embora no meio da decisão.
                         */
                        onClick={(e) => {
                          if (confirmandoPasta) e.preventDefault();
                        }}
                        className="nx-edge-5 group/s relative flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 pl-3 text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground hover:[--nx-fill:var(--accent)] [&::-webkit-details-marker]:hidden"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 shrink-0 transition-transform duration-[var(--duration-fast)] group-open/f:rotate-90",
                            confirmandoPasta && "invisible",
                          )}
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        {confirmandoPasta && onDeleteFolder ? (
                          /*
                           * A pergunta ocupa a linha da pasta, como a da
                           * conversa ocupa a dela. Dentro do `<summary>` e não
                           * abaixo dele porque o `<details>` pode estar
                           * fechado — e uma confirmação escondida dentro de um
                           * grupo recolhido seria um botão de apagar sem
                           * pergunta.
                           *
                           * A CONTAGEM ESTÁ NA FRASE. É a diferença entre esta
                           * pergunta e a de uma conversa só, e é o único dado
                           * que dimensiona o estrago.
                           */
                          <span className="nx-cut-6 flex-1 space-y-1.5 border-0 bg-[var(--status-critical-bg)] px-2 py-1.5">
                            <span className="block text-[11.5px] normal-case leading-4 text-muted-foreground">
                              Apagar {g.key ?? "as conversas sem pasta"}
                              {g.key ? ` e as ${g.items.length} conversas dentro dela` : ` (${g.items.length})`},
                              com os documentos gerados.
                            </span>
                            <span className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setConfirmando(null);
                                }}
                                className="nx-edge-5 px-1.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  onDeleteFolder(g.items.map((c) => c.id));
                                  setConfirmando(null);
                                }}
                                /*
                                       * O MIOLO PRECISA SER OPACO.
                                       *
                                       * `--status-critical-bg` é translúcido, e
                                       * o `::before` do `.nx-edge-*` compõe
                                       * sobre o fundo do próprio elemento — que
                                       * é a BORDA, salmão cheio. O resultado era
                                       * um bloco salmão com o texto salmão por
                                       * cima: o botão mais perigoso da coluna
                                       * sem rótulo legível. A mistura devolve a
                                       * mesma cor pretendida, só que opaca.
                                       */
                                      className="nx-edge-5 border-0 px-2 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] text-[var(--status-critical)] transition-colors focus-visible:outline-none [--nx-edge:var(--status-critical)] [--nx-fill:color-mix(in_oklab,var(--status-critical)_16%,var(--card))]"
                              >
                                Apagar
                              </button>
                            </span>
                          </span>
                        ) : (
                          <>
                            <span className="flex-1 truncate font-mono text-[11.5px] font-medium uppercase tracking-[0.05em]">
                              {g.key ?? "Sem pasta"}
                            </span>
                            {/*
                              A contagem SAI enquanto os botões entram. Não há
                              largura para os dois numa coluna de 300px, e
                              reservar espaço fixo para ações que quase nunca
                              aparecem encolheria o nome da obra o tempo todo.
                            */}
                            <span
                              className={cn(
                                "font-mono text-[11.5px] tabular-nums text-muted-foreground/70 transition-opacity duration-[var(--duration-fast)]",
                                (onDeleteFolder || onDuplicate) &&
                                  "group-hover/s:opacity-0 group-focus-within/s:opacity-0",
                              )}
                            >
                              {g.items.length}
                            </span>
                            {(onDuplicate || onDeleteFolder) && (
                              <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover/s:opacity-100 group-focus-within/s:opacity-100">
                                {onDuplicate && g.items.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      // A mais RECENTE do grupo: é dela que se
                                      // continua o trabalho da obra.
                                      onDuplicate(g.items[0].id);
                                    }}
                                    aria-label={`Nova conversa a partir da mais recente de ${g.key ?? "sem pasta"}`}
                                    className="nx-edge-4 p-1.5 text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground focus-visible:[--nx-fill:var(--accent)]"
                                  >
                                    <CopyPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </button>
                                )}
                                {onDeleteFolder && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setConfirmando({ tipo: "pasta", id: idDaPasta });
                                    }}
                                    aria-label={`Apagar a pasta ${g.key ?? "Sem pasta"} inteira`}
                                    className="nx-edge-4 p-1.5 text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-[var(--status-critical)] focus-visible:[--nx-fill:var(--accent)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </button>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </summary>
                      <ul className="flex flex-col gap-px py-0.5 pl-3">
                        {g.items.map((c) => {
                          const active = c.id === activeId;
                          return (
                            <li key={c.id} className="group/c relative">
                              <button
                                type="button"
                                onClick={() => onSelect?.(c.id)}
                                aria-current={active ? "true" : undefined}
                                className={cn(
                                  /*
                                   * Uma linha, não duas. O título e a data
                                   * disputavam altura numa coluna estreita, e a
                                   * data ficava abaixo do piso de legibilidade.
                                   *
                                   * Lado a lado, a lista mostra quase o dobro
                                   * de conversas, que é o trabalho dela: achar
                                   * a de ontem.
                                   */
                                  /* Item de lista: corte 5. SO O ATIVO tem
                                     fundo -- o inativo fica transparente e
                                     ganha fundo no hover. */
                                  "nx-edge-5 flex min-h-[34px] w-full items-center gap-2.5 py-2 pl-2.5 pr-9 text-left transition-colors duration-[var(--duration-fast)] ease-[var(--ease-feedback)] focus-visible:outline-none [--nx-edge:transparent]",
                                  active
                                    ? "text-foreground [--nx-fill:var(--accent)]"
                                    : "text-muted-foreground [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground hover:[--nx-fill:var(--accent)]",
                                )}
                              >
                                {/*
                                  Marca do tipo: lembrete PERIFÉRICO, em cinza.
                                  Some no item ativo, onde disputaria com o
                                  texto — `invisible` e não removida, para a
                                  linha não pular de posição ao selecionar.
                                */}
                                <span
                                  aria-hidden
                                  style={{ background: s.marca }}
                                  className={cn(
                                    "h-[15px] w-0.5 shrink-0",
                                    active && "invisible",
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                                  {c.title}
                                </span>
                                {/*
                                  Veio de outra máquina. A conversa abre
                                  inteira, mas os ODT/PDF/ZIP gerados não vieram
                                  junto — eles moram no navegador que os gerou.
                                  Cinza, não teal: é estado, e teal aqui
                                  significaria que se pode clicar (§ cor).
                                */}
                                {c.soNoServidor && (
                                  <Cloud
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
                                    strokeWidth={1.5}
                                    aria-label="Do servidor: os arquivos gerados não estão nesta máquina"
                                  />
                                )}
                                {/*
                                  A hora dá lugar às ações no hover — mesma
                                  troca do cabeçalho da pasta. Com duas ações,
                                  o espaço reservado à direita teria de dobrar,
                                  e ele sairia do título.
                                */}
                                <span
                                  className={cn(
                                    "shrink-0 font-mono text-[11.5px] tabular-nums text-muted-foreground/70 transition-opacity duration-[var(--duration-fast)]",
                                    onDuplicate && "group-hover/c:opacity-0",
                                  )}
                                >
                                  {shortDate(c.updatedAt)}
                                </span>
                              </button>
                              {onDuplicate && confirmando?.id !== c.id && (
                                /*
                                 * NOVA A PARTIR DESTA. Leva os selos já lidos e
                                 * o memorial retido; não leva as mensagens nem
                                 * os documentos gerados. É o que evita subir e
                                 * reler as mesmas 200 pranchas para montar o
                                 * volume seguinte da mesma obra.
                                 */
                                <button
                                  type="button"
                                  onClick={() => onDuplicate(c.id)}
                                  aria-label={`Nova conversa a partir de ${c.title}`}
                                  className={cn(
                                    "nx-edge-4 absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground",
                                    "[--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)]",
                                    "transition-[opacity,color] duration-[var(--duration-fast)]",
                                    "hover:text-foreground focus-visible:outline-none",
                                    "opacity-0 group-hover/c:opacity-100 focus-visible:opacity-100",
                                  )}
                                >
                                  <CopyPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </button>
                              )}
                              {onDelete && confirmando?.id !== c.id && (
                                /*
                                 * O gatilho fica SEMPRE presente, a 0 de
                                 * opacidade só enquanto o ponteiro não chega.
                                 * Revelar por hover apenas o tornava
                                 * inalcançável no toque, onde não existe hover
                                 * — e a §7 pede afordância consistente, não
                                 * escondida. Aparece também no foco do teclado
                                 * e quando a linha está ativa, que é onde a mão
                                 * costuma estar.
                                 */
                                <button
                                  type="button"
                                  onClick={() => setConfirmando({ tipo: "conversa", id: c.id })}
                                  aria-label={`Apagar conversa ${c.title}`}
                                  className={cn(
                                    "nx-edge-4 absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground",
                                    "[--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)]",
                                    "transition-[opacity,color] duration-[var(--duration-fast)]",
                                    "hover:text-[var(--status-critical)] focus-visible:outline-none",
                                    "opacity-0 group-hover/c:opacity-100 focus-visible:opacity-100",
                                    active && "opacity-60",
                                  )}
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </button>
                              )}
                              {onDelete &&
                                confirmando?.tipo === "conversa" &&
                                confirmando.id === c.id && (
                                /*
                                 * A confirmação SUBSTITUI a linha, não flutua
                                 * sobre ela. Antes era uma tarja no canto, por
                                 * cima do título da conversa que se está
                                 * prestes a apagar — justamente o que se
                                 * precisa ler para decidir. Agora o nome fica
                                 * visível acima, e a pergunta ocupa o seu
                                 * próprio espaço.
                                 *
                                 * Inline e não modal: a §11 manda esgotar as
                                 * alternativas antes do modal, e apagar uma
                                 * conversa não merece parar a tela inteira. Mas
                                 * leva os documentos gerados junto — por isso
                                 * pergunta.
                                 */
                                /*
                                 * EMPILHADO, não lado a lado: numa coluna
                                 * estreita a frase e dois botões na mesma linha
                                 * não cabem — o texto quebrava em cinco linhas
                                 * e passava por cima do "Cancelar". Só apareceu
                                 * no print.
                                 */
                                /* Sem camada de contorno, pela mesma razao do
                                   badge: borda E fundo translucidos nao
                                   sobrevivem a composicao em duas formas -- o
                                   miolo pintaria sobre a cor da borda. */
                                <div className="nx-cut-6 mt-0.5 space-y-1.5 border-0 bg-[var(--status-critical-bg)] px-2 py-2">
                                  <p className="text-[11.5px] leading-4 text-muted-foreground">
                                    Apagar leva os documentos gerados junto.
                                  </p>
                                  <span className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmando(null)}
                                      className="nx-edge-5 px-1.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onDelete(c.id);
                                        setConfirmando(null);
                                      }}
                                      /*
                                       * O MIOLO PRECISA SER OPACO.
                                       *
                                       * `--status-critical-bg` é translúcido, e
                                       * o `::before` do `.nx-edge-*` compõe
                                       * sobre o fundo do próprio elemento — que
                                       * é a BORDA, salmão cheio. O resultado era
                                       * um bloco salmão com o texto salmão por
                                       * cima: o botão mais perigoso da coluna
                                       * sem rótulo legível. A mistura devolve a
                                       * mesma cor pretendida, só que opaca.
                                       */
                                      className="nx-edge-5 border-0 px-2 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] text-[var(--status-critical)] transition-colors focus-visible:outline-none [--nx-edge:var(--status-critical)] [--nx-fill:color-mix(in_oklab,var(--status-critical)_16%,var(--card))]"
                                    >
                                      Apagar
                                    </button>
                                  </span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                    );
                  })}
              </div>
            );
          })}
      </div>

      {/*
        A SINCRONIZAÇÃO SÓ APARECE QUANDO FALHA.

        Um selo verde de "salvo" a cada tecla seria ruído: gravar é o esperado,
        e o esperado não merece pixel. O que merece é a diferença que ninguém
        adivinha — o trabalho está no disco DESTA máquina e não subiu. Por isso
        o texto diz as duas coisas: o que está garantido e o que não está.

        Amarelo de atenção, não vermelho: nada se perdeu.
      */}
      {sincronizacao?.estado === "falhou" && (
        <div
          role="status"
          className="nx-cut-6 flex items-start gap-2 border-0 bg-[var(--status-warning)]/5 px-2.5 py-2"
        >
          <CloudOff
            className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <span className="text-[11.5px] leading-snug text-muted-foreground">
            Salvo nesta máquina, mas não no servidor.
            <span className="block text-muted-foreground/70">
              {sincronizacao.motivo}
            </span>
          </span>
        </div>
      )}

      {/*
        Rodapé, camada 1: o resto do software em FILEIRA DE ÍCONES.

        Quatro linhas rotuladas custavam ~140px de altura para destinos que se
        visitam uma vez por semana — altura tirada da lista, que é o que se usa
        o dia inteiro. Em ícones, a mesma navegação cabe em 38px.

        O preço do ícone é a legenda: cada botão exige `aria-label` E tooltip
        com o mesmo texto do rótulo antigo. Ícone sem nome é adivinhação, e
        adivinhação em navegação é o pior lugar para colocá-la.
      */}
      <nav
        aria-label="Resto do software"
        className="flex items-center gap-1 border-t border-border/60 pt-2.5"
      >
        <BotaoDeIcone rotulo="Projetos" href="/projetos" Icone={FolderKanban} />
        {isAdmin && (
          <BotaoDeIcone rotulo="Painel admin" href="/admin" Icone={Gauge} />
        )}
        {onVerTour && (
          <BotaoDeIcone
            rotulo="Como funciona"
            onClick={() => void onVerTour()}
            Icone={Compass}
          />
        )}
        {/* Cor de legado: presente sem chamar. Nem status, nem desabilitado — a
            ferramenta funciona, só não é o caminho novo. Por último, sempre:
            é saída de emergência, não destino. */}
        <BotaoDeIcone
          rotulo="Ferramentas antigas"
          href="/ferramentas"
          Icone={Wrench}
          legado
        />
      </nav>

      {/*
        Rodapé, camada 2: A CONTA.

        Linha inteira e fundo próprio, não mais um "Conta" cinza que não fazia
        nada. Nome e e-mail vêm da sessão — sem sessão o bloco não renderiza,
        porque um bloco de conta sem conta é uma caixa vazia ocupando o lugar
        mais estável da coluna.

        O menu abre PARA CIMA: o primitivo mede o espaço e vira sozinho (ver
        `Dropdown`), o que aqui é a regra e não o caso raro — o gatilho encosta
        no rodapé da janela.
      */}
      {nome && (
        <Dropdown
          align="start"
          panelClassName="w-[calc(var(--nexo-sidebar-w)-28px)]"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              className="nx-edge-8 flex w-full items-center gap-3 p-2.5 text-left transition-colors focus-visible:outline-none [--nx-edge:var(--input)] [--nx-fill:var(--input)] hover:[--nx-edge:#3a4249] hover:[--nx-fill:#3a4249]"
            >
              <span className="nx-cut-6 flex size-[34px] shrink-0 items-center justify-center border-0 bg-[var(--nexodoc-recessed)] font-mono text-[12.5px] font-semibold text-[var(--nexodoc-accent)]">
                {iniciais(nome)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13.5px] text-foreground">
                  {nome}
                </span>
                {email && (
                  <span className="truncate font-mono text-[11.5px] text-muted-foreground">
                    {email}
                  </span>
                )}
              </span>
              <ChevronUp
                className="h-[15px] w-[15px] shrink-0 text-muted-foreground"
                strokeWidth={1.6}
                aria-hidden
              />
            </button>
          )}
        >
          {({ close }) => (
            <>
              {onPreferencias && (
                <DropdownItem
                  onClick={() => {
                    close();
                    void onPreferencias();
                  }}
                >
                  <Settings className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                  Preferências
                </DropdownItem>
              )}
              <SignOutMenuItem onDone={close} />
            </>
          )}
        </Dropdown>
      )}
    </aside>
  );
}

/**
 * Um destino do rodapé, em ícone.
 *
 * `aria-label` E tooltip com o MESMO texto, sempre: o primeiro é para quem não
 * vê o ícone, o segundo para quem vê e não o reconhece. Um sem o outro deixa
 * metade das pessoas adivinhando.
 */
function BotaoDeIcone({
  rotulo,
  href,
  onClick,
  Icone,
  legado = false,
}: {
  rotulo: string;
  href?: string;
  onClick?: () => void;
  Icone: typeof Layers;
  legado?: boolean;
}) {
  const classe = cn(
    "nx-edge-6 flex h-[38px] w-11 shrink-0 items-center justify-center transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:[--nx-fill:var(--accent)]",
    legado
      ? "text-[var(--legacy)]/80 hover:text-[var(--legacy)]"
      : "text-muted-foreground hover:text-foreground",
  );
  const icone = (
    <Icone className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link href={href} aria-label={rotulo} className={classe}>
            {icone}
          </Link>
        ) : (
          <button type="button" onClick={onClick} aria-label={rotulo} className={classe}>
            {icone}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{rotulo}</p>
      </TooltipContent>
    </Tooltip>
  );
}
