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
  TriangleAlert,
  Compass,
  CopyPlus,
  Eraser,
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
import { ListaDeProjetos } from "./ListaDeProjetos";
import { LimpezaDaPasta } from "./LimpezaDaPasta";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { SignOutMenuItem } from "@/components/sign-out-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConversationSummary, TipoDeTrabalho } from "../lib/nexo-db";
import { avisoDeGravacao } from "../lib/aviso-de-gravacao";
import type { EstadoDaSincronizacao } from "../lib/nexo-sync";
import { tipoDoResumo } from "../lib/tipo-de-trabalho";
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

/** As duas seções, na ordem em que aparecem. */
/*
 * A TABELA DAS SEÇÕES saiu daqui em 19/08/2026, junto com as seções.
 *
 * Ela dava título, ícone, cor de marca e frase de vazio a "Montagem de volumes"
 * e "Auditoria de memoriais" — os dois cabeçalhos que dividiam o histórico. Com
 * a PASTA no topo, o projeto passou a aparecer uma vez só e o tipo de trabalho
 * virou etiqueta: a cor da marca agora sai do tipo de CADA CONVERSA, ali na
 * linha, porque é dentro da pasta que os dois trabalhos se misturam.
 */

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
  gravacaoLocal,
}: {
  onNewConversation?: () => void;
  conversations?: ConversationSummary[];
  /** Última ida ao servidor. Só desenha algo quando falhou. */
  sincronizacao?: EstadoDaSincronizacao;
  /**
   * Última gravação no disco desta máquina. Junto com `sincronizacao`,
   * decide se a falha é informação ou alarme — ver [[aviso-de-gravacao.ts]].
   */
  gravacaoLocal?: "ok" | "falhou";
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
  /**
   * QUAL PASTA está com a limpeza aberta, ou `null`.
   *
   * Uma por vez, e ela desarma a confirmação de apagar (e vice-versa): dois
   * painéis destrutivos abertos ao mesmo tempo numa coluna de 300px é como se
   * clica no errado.
   */
  const [limpando, setLimpando] = useState<string | null>(null);
  const empty = conversations.length === 0;
  const [confirmando, setConfirmando] = useState<{
    tipo: "conversa" | "pasta";
    id: string;
  } | null>(null);

  return (
    <aside
      aria-label="Navegação do Nexo"
      className="flex h-full w-full flex-col gap-3 border-r border-border/60 p-3.5"
    >
      {/*
        Topo: a marca — e, desde 25/08/2026, a VOLTA.

        O comentário aqui dizia "não há mais 'voltar' — a entrada do software é
        esta tela", e isso deixou de ser verdade quando a raiz virou o painel. O
        efeito era um beco: daqui saía-se para Projetos, Admin e Ferramentas
        (rodapé), e não havia caminho nenhum de volta para a tela em que a pessoa
        entra. Sobrava o botão do navegador, que não é interface.

        A marca é o lugar certo dessa volta, e não um controle novo: ela já é o
        objeto de identidade no canto superior esquerdo, que é onde toda a web
        aprendeu a clicar para voltar ao começo. O botão do orbe do painel
        (`components/layout/botao-do-orbe.tsx`) é a mesma porta pelo outro lado —
        ele já sabe alternar sozinho, por rota, se um dia o cromo do Nexo quiser
        montá-lo.

        E ela DIZ O QUE O AGENTE ESTÁ FAZENDO.

        A §6 é clara: "em repouso ela fica PARADA; marca que se mexe sozinha
        vira decoração". Um laço permanente aqui seria isso. Mas o orbe é a
        presença do agente, e movimento que carrega ESTADO é o trabalho dele,
        não enfeite — a mesma regra da §5.

        Vale mais aqui do que no palco: a barra lateral está sempre visível,
        enquanto o orbe grande sai de vista quando se rola a conversa ou se olha
        o canvas. Trabalhando, ela respira; parada, fica parada.
      */}
      <Link
        href="/"
        aria-label="Voltar ao painel"
        title="Voltar ao painel"
        className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-opacity duration-[var(--duration-fast)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
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
      </Link>

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
        Novo projeto
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
      {/*
        A LISTA DE PROJETOS.

        Saíram daqui as três abas (Tudo / Volumes / Auditorias) e a lista de
        conversas. As abas porque a terceira NÃO CABIA em 300px — aparecia
        cortada na tela — e porque filtrar por TIPO responde uma pergunta que
        ninguém faz: quem procura, procura a obra. A lista de conversas porque
        quatro linhas "MET" na mesma pasta não distinguiam nada, e a única
        diferença visível era o horário.

        Desenho: `Nexo - Barra lateral direções.dc.html` e
        `Nexo - Especificação barra lateral.dc.html`.
      */}
      <div
        id="nexo-historico"
        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto"
      >
        {empty ? (
          /*
           * ESTADO VAZIO conforme a DESIGN.md §7: um Mono Label nomeando a
           * região e uma linha dizendo o que vai aparecer ali. Sem ação — aqui
           * não há nada a fazer, e ação inventada num vazio é confissão de que
           * a tela não sabe o que quer.
           */
          <div className="rounded-[4px] border border-dashed border-border/60 px-3 py-3">
            <p className="m-0 font-mono text-[11.5px] uppercase tracking-[0.07em] text-muted-foreground">
              Projetos
            </p>
            <p className="m-0 mt-1.5 text-xs leading-5 text-muted-foreground">
              Cada obra vira um cartão aqui, com o que ela já produziu. O projeto
              nasce do carimbo: solte as pranchas na conversa.
            </p>
          </div>
        ) : (
          <ListaDeProjetos
            conversations={conversations}
            query={query}
            {...(activeId ? { activeId } : {})}
            {...(onSelect ? { onSelect } : {})}
            {...(onDeleteFolder ? { onDeleteFolder } : {})}
            {...(onDuplicate ? { onDuplicate } : {})}
          />
        )}
      </div>

      {/*
        A GRAVAÇÃO SÓ APARECE QUANDO FALHA — E O VOLUME VEM DO RISCO.

        Um selo verde de "salvo" a cada tecla seria ruído: gravar é o esperado,
        e o esperado não merece pixel. O que merece é a diferença que ninguém
        adivinha. E ela tem DOIS tamanhos, que este bloco antes não distinguia
        porque só enxergava o servidor:

        - uma das duas cópias falhou → o trabalho está a salvo na outra. Âmbar,
          informativo, texto dizendo o que está garantido e o que não está.
        - as DUAS falharam → o trabalho existe só nesta aba, e fechá-la o perde.
          Aí é alarme, e é o único caso que merece esse peso.

        Quem decide é [[aviso-de-gravacao.ts]], para a regra ficar travada por
        teste em vez de morar numa condição JSX que ninguém consegue exercitar.
      */}
      {(() => {
        const nivel = avisoDeGravacao(
          gravacaoLocal ?? "ok",
          sincronizacao?.estado ?? "desligada",
        );
        if (nivel === "nenhum") return null;

        /*
          GRAVE tem tratamento próprio: é o único caso em que o trabalho pode
          sumir, e num produto que sustenta emissão de projeto isso pode ser um
          parecer pago.

          `--status-critical-tint` no fundo, NÃO `--status-critical`: o
          `--nx-fill` translúcido dentro de `.nx-edge-*` deixa a cor da borda
          atravessar o miolo, e foi assim que o admin renderizou coral sobre
          coral em 1:1 — com a prova passando verde (DESIGN.md §2).
        */
        if (nivel === "grave") {
          return (
            <div
              role="alert"
              className="nx-cut-6 flex items-start gap-2 border-0 bg-[var(--status-critical-tint)] px-2.5 py-2"
            >
              <TriangleAlert
                className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--status-critical)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="text-[11.5px] leading-snug text-foreground">
                Não foi possível salvar este trabalho.
                <span className="block text-muted-foreground">
                  Exporte o parecer antes de fechar esta aba.
                </span>
              </span>
            </div>
          );
        }

        return (
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
              {nivel === "so-disco"
                ? "Salvo nesta máquina, mas não no servidor."
                : "Salvo no servidor, mas não neste computador."}
              <span className="block text-muted-foreground/70">
                {nivel === "so-disco"
                  ? sincronizacao?.estado === "falhou"
                    ? sincronizacao.motivo
                    : ""
                  : "O trabalho está seguro. Este navegador pode estar sem espaço."}
              </span>
            </span>
          </div>
        );
      })()}

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
