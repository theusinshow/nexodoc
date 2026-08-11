"use client";

/**
 * Sidebar cheia do Nexo. Topo = voltar + marca; meio = Nova conversa + BUSCA +
 * Histórico agrupado em PASTAS por obra (código dos selos), recolhíveis; base =
 * Conta. Matte, calma (superfície de leitura). Persistência real (IndexedDB).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cloud,
  CloudOff,
  Folder,
  FolderKanban,
  Gauge,
  Plus,
  Compass,
  Search,
  Trash2,
  User,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationSummary } from "../lib/nexo-db";
import type { EstadoDaSincronizacao } from "../lib/nexo-sync";
import { groupConversations } from "../lib/group-conversations";
import { LogoNexo } from "@/components/brand/logo-nexo";

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

export function NexoSidebar({
  onNewConversation,
  conversations = [],
  activeId,
  onSelect,
  onDelete,
  isAdmin = false,
  onVerTour,
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
  /** Mostra o painel admin no rodapé. Vem da sessão, no server. */
  isAdmin?: boolean;
  /** Reabre o passo a passo guiado. Ausente = a entrada não aparece. */
  onVerTour?: () => void | Promise<void>;
  /**
   * O agente está trabalhando (lendo selos, pensando, respondendo, auditando).
   * A marca respira enquanto isso — é o único movimento contínuo daqui, e ele
   * significa estado, não decoração.
   */
  trabalhando?: boolean;
}) {
  const [query, setQuery] = useState("");
  /** Conversa aguardando confirmação de exclusão (uma por vez). */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const groups = useMemo(
    () => groupConversations(conversations, query),
    [conversations, query],
  );
  const empty = conversations.length === 0;
  const noMatch = !empty && groups.length === 0;

  return (
    <aside
      aria-label="Navegação do Nexo"
      className="flex h-full w-full flex-col gap-3 border-r border-border/60 p-3"
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
      <div className="flex items-center gap-2 px-1 py-1">
        <span
          className={cn(
            "inline-flex",
            trabalhando && "nexodoc-status-pulse",
          )}
          title={trabalhando ? "O Nexo está trabalhando" : undefined}
        >
          <LogoNexo size={20} />
        </span>
        <span className="font-mono text-sm font-semibold tracking-[-0.01em]">
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

      {/* Nova conversa */}
      <button
        type="button"
        onClick={onNewConversation}
        className="nx-edge-6 flex items-center gap-2 px-2.5 py-2 text-sm text-foreground transition-colors focus-visible:outline-none [--nx-edge:var(--nexodoc-recessed)] [--nx-fill:var(--nexodoc-recessed)] hover:[--nx-edge:var(--accent)] hover:[--nx-fill:var(--accent)]"
      >
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        Nova conversa
      </button>

      {/* Busca */}
      {!empty && (
        <div className="relative">
          <Search
            /* z-10: o wrapper do campo vem DEPOIS no DOM e tambem e posicionado,
               entao sem isto ele pinta por cima da lupa e ela some. */
            className="pointer-events-none absolute left-2.5 top-2 z-10 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          {/* Wrapper pela mesma razao do primitivo Input: campo nativo nao
              renderiza ::before, entao a camada de contorno mora fora. */}
          <div className="nx-edge-6 h-8 w-full [--nx-edge:var(--nexodoc-recessed)] [--nx-fill:var(--nexodoc-recessed)]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas…"
              aria-label="Buscar conversas"
              className="size-full border-0 bg-transparent pl-8 pr-2 font-mono text-xs text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/* Histórico agrupado por pasta */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {empty && (
          /*
           * ESTADO VAZIO conforme a DESIGN.md §7: um Mono Label nomeando a
           * região e uma linha dizendo o que vai aparecer ali. Sem ação —
           * aqui não há nada a fazer, e ação inventada num vazio é confissão
           * de que a tela não sabe o que quer.
           *
           * Antes era `flex-1` centralizado: a caixa esticava ~590px para
           * caber uma frase, e o rótulo da região tinha sumido na
           * implementação. Agora ela ocupa o que o conteúdo pede.
           */
          /* Raio de 4px, nao chanfro: tracejado nao sobrevive ao recorte (a
             borda sumiria nas duas diagonais). Mesmo tratamento que a spec da
             aos campos tracejados do carimbo. */
          <div className="space-y-1.5 rounded-[4px] border border-dashed border-border/60 px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
              Histórico
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Suas conversas e volumes ficam salvos aqui.
            </p>
          </div>
        )}
        {noMatch && (
          /* Diz ONDE buscou. Só "nada encontrado" faz o engenheiro duvidar se
             digitou errado, quando o problema pode ser o campo que não é
             coberto pela busca. */
          <p className="px-2 py-3 text-center text-xs leading-5 text-muted-foreground">
            Nenhuma conversa com “{query}”.
            <br />A busca cobre o título da obra e o código do projeto.
          </p>
        )}
        {groups.map((g) => (
          <details key={g.key ?? "__none__"} open className="group/f">
            {/*
              A pasta é o CÓDIGO DA OBRA, e é por ele que se procura. Sai em
              Mono Label maiúsculo — o degrau que a §3 reserva para rótulo de
              região —, e o ícone de pasta saiu: o chevron e o recuo já dizem
              que é um grupo, e dois glifos para o mesmo trabalho é ruído numa
              coluna de 240px.
            */}
            {/* `.nx-edge-5` com tokens transparentes: sem forma em repouso, mas
                com o anel de foco POR DENTRO de graca. `.nx-cut-*` sozinho
                desligaria o ring global sem por nada no lugar, e um focalizavel
                sem foco visivel e regressao de acessibilidade. */}
            <summary className="nx-edge-5 flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground hover:[--nx-fill:var(--accent)] [&::-webkit-details-marker]:hidden">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3 w-3 shrink-0 transition-transform duration-[var(--duration-fast)] group-open/f:rotate-90"
                aria-hidden
              >
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="flex-1 truncate font-mono text-[11px] font-medium uppercase tracking-[0.05em]">
                {g.key ?? "Sem pasta"}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
                {g.items.length}
              </span>
            </summary>
            <ul className="flex flex-col gap-px py-0.5 pl-5">
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
                         * Uma linha, não duas. O título e a data disputavam
                         * altura numa coluna de 240px, e a data ficava a 9,5px
                         * — abaixo do piso de 11px que a §3 estabelece, e fora
                         * da escala como o título a 12,5px.
                         *
                         * Lado a lado, a lista mostra quase o dobro de
                         * conversas, que é o trabalho dela: achar a de ontem.
                         */
                        /* Item de lista: corte 5. SO O ATIVO tem fundo -- o
                           inativo fica transparente e ganha fundo no hover. */
                        "nx-edge-5 flex w-full items-baseline gap-2 py-1.5 pl-2.5 pr-8 text-left transition-colors focus-visible:outline-none [--nx-edge:transparent]",
                        active
                          ? "text-foreground [--nx-fill:var(--accent)]"
                          : "text-muted-foreground [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground hover:[--nx-fill:var(--accent)]",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs">{c.title}</span>
                      {/*
                        Veio de outra máquina. A conversa abre inteira, mas os
                        ODT/PDF/ZIP gerados não vieram junto — eles moram no
                        navegador que os gerou. Cinza, não teal: é estado, e
                        teal aqui significaria que se pode clicar (§ cor).
                      */}
                      {c.soNoServidor && (
                        <Cloud
                          className="h-3 w-3 shrink-0 self-center text-muted-foreground/50"
                          strokeWidth={1.5}
                          aria-label="Do servidor: os arquivos gerados não estão nesta máquina"
                        />
                      )}
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/60">
                        {shortDate(c.updatedAt)}
                      </span>
                    </button>
                    {onDelete && confirmando !== c.id && (
                      /*
                       * O gatilho fica SEMPRE presente, a 0 de opacidade só
                       * enquanto o ponteiro não chega. Revelar por hover apenas
                       * o tornava inalcançável no toque, onde não existe hover
                       * — e a §7 pede afordância consistente, não escondida.
                       * Aparece também no foco do teclado e quando a linha está
                       * ativa, que é onde a mão costuma estar.
                       */
                      <button
                        type="button"
                        onClick={() => setConfirmando(c.id)}
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
                    {onDelete && confirmando === c.id && (
                      /*
                       * A confirmação SUBSTITUI a linha, não flutua sobre ela.
                       * Antes era uma tarja no canto, por cima do título da
                       * conversa que se está prestes a apagar — justamente o
                       * que se precisa ler para decidir. Agora o nome fica
                       * visível acima, e a pergunta ocupa o seu próprio espaço.
                       *
                       * Inline e não modal: a §11 manda esgotar as alternativas
                       * antes do modal, e apagar uma conversa não merece parar
                       * a tela inteira. Mas leva os documentos gerados junto —
                       * por isso pergunta.
                       */
                      /*
                       * EMPILHADO, não lado a lado: numa coluna de 240px a
                       * frase e dois botões na mesma linha não cabem — o texto
                       * quebrava em cinco linhas e passava por cima do
                       * "Cancelar". Só apareceu no print.
                       */
                      /* Sem camada de contorno, pela mesma razao do badge: borda
                         E fundo translucidos nao sobrevivem a composicao em
                         duas formas -- o miolo pintaria sobre a cor da borda. */
                      <div className="nx-cut-6 mt-0.5 space-y-1.5 border-0 bg-[var(--status-critical-bg)] px-2 py-2">
                        <p className="text-[11px] leading-4 text-muted-foreground">
                          Apagar leva os documentos gerados junto.
                        </p>
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirmando(null)}
                            className="nx-edge-5 px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)] hover:text-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(c.id);
                              setConfirmando(null);
                            }}
                            className="nx-edge-5 border-0 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--status-critical)] transition-colors focus-visible:outline-none [--nx-edge:var(--status-critical)] [--nx-fill:var(--status-critical-bg)]"
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
        ))}
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
          <span className="text-[11px] leading-snug text-muted-foreground">
            Salvo nesta máquina, mas não no servidor.
            <span className="block text-muted-foreground/70">{sincronizacao.motivo}</span>
          </span>
        </div>
      )}

      {/*
        Rodapé: o resto do software. Projetos é destino de trabalho; ferramentas
        antigas é saída de emergência e por isso vem menor e por último — visível
        para quem procura, sem competir com o caminho bom.
      */}
      <div className="flex flex-col gap-0.5 border-t border-border/60 pt-2">
        <Link
          href="/projetos"
          className="nx-edge-5 flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]"
        >
          <FolderKanban className="h-4 w-4 shrink-0" aria-hidden />
          Projetos
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="nx-edge-5 flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]"
          >
            <Gauge className="h-4 w-4 shrink-0" aria-hidden />
            Painel admin
          </Link>
        )}
        <button
          type="button"
          className="nx-edge-5 flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]"
        >
          <User className="h-4 w-4 shrink-0" aria-hidden />
          Conta
        </button>
        {onVerTour && (
          <button
            type="button"
            onClick={() => void onVerTour()}
            className="nx-edge-5 flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]"
          >
            <Compass className="h-4 w-4 shrink-0" aria-hidden />
            Como funciona
          </button>
        )}
        {/* Cor de legado no rótulo: presente sem chamar. Nem status, nem
            desabilitado — a ferramenta funciona, só não é o caminho novo. */}
        <Link
          href="/ferramentas"
          className="nx-edge-5 flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--legacy)]/80 transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-[var(--legacy)] hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]"
        >
          <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ferramentas antigas
        </Link>
      </div>
    </aside>
  );
}
