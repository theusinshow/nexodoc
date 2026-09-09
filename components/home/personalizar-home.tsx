"use client";

/**
 * PERSONALIZAR A HOME — um painel lateral, e não um modo de edição.
 *
 * Havia três formas possíveis: modal, drawer, ou "modo de edição" com a própria
 * Home virando editável. O modo de edição é o mais bonito e o errado aqui —
 * ele exige que cada widget saiba se desenhar em dois estados (vivo e
 * manipulável), e são cinco widgets com miolos completamente diferentes: um
 * cronômetro correndo, um `textarea` com foco, uma lista que busca da rede.
 * Cinco componentes com dois modos cada é dez comportamentos para um painel de
 * preferência.
 *
 * O DRAWER é o que o produto já usa para "ajustar o que está na tela"
 * (`NexoDebugDrawer`, o drawer de Detalhes da auditoria), entra pela direita
 * sem tirar a Home de vista, e cabe as duas metades da personalização: o que
 * aparece, e como a lista se comporta.
 *
 * A ORDEM SE ARRASTA, e o `@dnd-kit` já estava no projeto (o montador de volume
 * o usa). Nenhuma dependência nova para isto — era a pergunta que a pesquisa de
 * bibliotecas tinha que responder, e a resposta foi "não instale nada".
 *
 * TECLADO INCLUÍDO, e não é acessório: `KeyboardSensor` mais as setas de subir
 * e descer ao lado de cada linha. Uma lista que só se reordena com o mouse é
 * uma preferência que uma parte das pessoas não consegue mudar — e o custo de
 * evitar isso são dois botões.
 *
 * SEM `@dnd-kit/modifiers`. Ele daria o `restrictToVerticalAxis`, que impede o
 * fantasma de derivar na horizontal — puro cosmético, já que
 * `verticalListSortingStrategy` decide as posições sozinha. Um pacote a mais no
 * `package.json` por causa disso é exatamente a compra que não se faz.
 */

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";

import { ORDENS, type OrdemDaLista } from "@/lib/atencao-do-painel";
import {
  CATALOGO,
  PADRAO,
  PROJETOS_VISIVEIS,
  type EscopoDaLista,
  type PreferenciasDaHome,
} from "@/lib/preferencias-da-home";
import { cn } from "@/lib/utils";

export function PersonalizarHome({
  prefs,
  aoMudar,
  aoFechar,
}: {
  prefs: PreferenciasDaHome;
  aoMudar: (p: PreferenciasDaHome) => void;
  aoFechar: () => void;
}) {
  /*
   * APLICA NA HORA, e não ao "Concluir".
   *
   * O drawer é estreito e a Home continua visível ao lado: ligar um widget e
   * vê-lo aparecer atrás do painel é a confirmação que um botão de salvar
   * substituiria por fé. E remove o pior estado de um painel de preferências —
   * "mudei e não sei se pegou". O botão de baixo fecha; ele não confirma.
   */
  const mudar = (delta: Partial<PreferenciasDaHome>) => aoMudar({ ...prefs, ...delta });

  const sensores = useSensors(
    // 6px antes de virar arrasto: sem a distância, o clique no botão de ligar
    // dentro da linha arrastável é engolido pelo gesto.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const desligados = CATALOGO.filter((w) => !prefs.widgets.includes(w.id));

  function aoSoltar(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;

    const de = prefs.widgets.indexOf(String(active.id));
    const para = prefs.widgets.indexOf(String(over.id));
    if (de < 0 || para < 0) return;

    mudar({ widgets: arrayMove(prefs.widgets, de, para) });
  }

  function mover(id: string, passo: -1 | 1) {
    const de = prefs.widgets.indexOf(id);
    const para = de + passo;
    if (de < 0 || para < 0 || para >= prefs.widgets.length) return;

    mudar({ widgets: arrayMove(prefs.widgets, de, para) });
  }

  React.useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => ev.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <>
      {/*
        O VÉU não escurece a Home: `bg-transparent` com o painel opaco ao lado.
        Escurecer o fundo diria "pare de olhar para lá", e é justamente para lá
        que a pessoa tem que olhar enquanto mexe nisto. Ele existe só para
        capturar o clique fora.
      */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />

      <aside
        role="dialog"
        aria-label="Personalizar a Home"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[380px] flex-col border-l border-border bg-[var(--card)]"
        style={{ animation: "nx-entra-da-direita var(--duration-base) var(--ease-entrance) both" }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
            Personalizar a Home
          </h2>
          <div className="flex-1" />
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="nx-cut-4 cursor-pointer p-1 text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)] hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Grupo titulo="Seu espaço">
            {prefs.widgets.length === 0 ? (
              <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-muted-foreground">
                Nenhum widget ligado — a seção não aparece na Home.
              </p>
            ) : null}

            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              onDragEnd={aoSoltar}
            >
              <SortableContext items={prefs.widgets} strategy={verticalListSortingStrategy}>
                <ul className="m-0 list-none p-0">
                  {prefs.widgets.map((id, i) => {
                    const ficha = CATALOGO.find((w) => w.id === id);
                    if (!ficha) return null;

                    return (
                      <LinhaLigada
                        key={id}
                        id={id}
                        nome={ficha.nome}
                        descricao={ficha.descricao}
                        fonte={ficha.fonte}
                        primeiro={i === 0}
                        ultimo={i === prefs.widgets.length - 1}
                        aoSubir={() => mover(id, -1)}
                        aoDescer={() => mover(id, 1)}
                        aoDesligar={() =>
                          mudar({ widgets: prefs.widgets.filter((w) => w !== id) })
                        }
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>

            {desligados.length > 0 ? (
              <>
                <p className="m-0 mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Disponíveis
                </p>
                <ul className="m-0 list-none p-0">
                  {desligados.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => mudar({ widgets: [...prefs.widgets, w.id] })}
                        className="nx-cut-5 flex w-full cursor-pointer items-start gap-3 px-2.5 py-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)]"
                      >
                        <span
                          aria-hidden
                          className="mt-[3px] font-mono text-[13px] leading-none text-muted-foreground"
                        >
                          +
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] text-foreground">{w.nome}</span>
                          <span className="block text-[11.5px] leading-4 text-muted-foreground">
                            {w.descricao}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Grupo>

          <Grupo titulo="Lista de projetos">
            <Interruptor
              rotulo="Mostrar “Precisa da sua atenção”"
              ligado={prefs.mostrarAtencao}
              aoAlternar={() => mudar({ mostrarAtencao: !prefs.mostrarAtencao })}
            />

            <Escolha
              rotulo="Projetos visíveis"
              valor={String(prefs.projetosVisiveis)}
              opcoes={PROJETOS_VISIVEIS.map((n) => ({ id: String(n), rotulo: String(n) }))}
              aoEscolher={(v) => mudar({ projetosVisiveis: Number(v) })}
            />

            <Escolha
              rotulo="Aba padrão"
              valor={prefs.escopo}
              opcoes={[
                { id: "meus", rotulo: "Meus" },
                { id: "todos", rotulo: "Todos" },
              ]}
              aoEscolher={(v) => mudar({ escopo: v as EscopoDaLista })}
            />

            <Escolha
              rotulo="Ordenação padrão"
              valor={prefs.ordem}
              opcoes={ORDENS.map((o) => ({ id: o.id as OrdemDaLista, rotulo: o.rotulo }))}
              empilhado
              aoEscolher={(v) => mudar({ ordem: v })}
            />
          </Grupo>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={() => aoMudar({ ...PADRAO })}
            className="cursor-pointer font-mono text-[11px] tracking-[0.04em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
          >
            Restaurar padrão
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={aoFechar}
            className="nx-edge-7 cursor-pointer px-4 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-colors [--nx-edge:var(--primary)] [--nx-fill:var(--primary)] hover:[--nx-edge:var(--primary-hover)] hover:[--nx-fill:var(--primary-hover)]"
          >
            Concluir
          </button>
        </footer>
      </aside>
    </>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="m-0 mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Uma linha de widget LIGADO: alça, nome, setas de teclado e o desligar. */
function LinhaLigada({
  id,
  nome,
  descricao,
  fonte,
  primeiro,
  ultimo,
  aoSubir,
  aoDescer,
  aoDesligar,
}: {
  id: string;
  nome: string;
  descricao: string;
  fonte: "servidor" | "navegador" | "nenhuma";
  primeiro: boolean;
  ultimo: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoDesligar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // O que está sendo arrastado fica translúcido em vez de sumir: um item
        // que desaparece do lugar de origem faz a lista pular e o alvo do
        // gesto mudar debaixo do cursor.
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      className={cn(
        "nx-cut-5 relative flex items-start gap-2 px-1.5 py-2",
        isDragging ? "bg-[var(--nexodoc-raised)]" : "hover:bg-[var(--nexodoc-raised)]",
      )}
    >
      <button
        type="button"
        aria-label={`Reordenar ${nome}`}
        {...attributes}
        {...listeners}
        className="mt-[2px] shrink-0 cursor-grab text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
      </button>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-foreground">{nome}</span>
        <span className="block text-[11.5px] leading-4 text-muted-foreground">
          {descricao}
          {/*
            DE ONDE VEM O DADO, dito na linha em que se liga o widget. "Fica
            neste navegador" muda o que a pessoa espera ao trocar de máquina, e
            é a hora de dizer isso — não depois, quando a nota tiver sumido.
          */}
          {fonte === "navegador" ? (
            <span className="text-[var(--muted-foreground)]"> · só neste navegador</span>
          ) : null}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5">
        <Setinha rotulo={`Subir ${nome}`} desativado={primeiro} aoClicar={aoSubir}>
          <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Setinha>
        <Setinha rotulo={`Descer ${nome}`} desativado={ultimo} aoClicar={aoDescer}>
          <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Setinha>
        <button
          type="button"
          onClick={aoDesligar}
          aria-label={`Desligar ${nome}`}
          className="nx-cut-4 cursor-pointer p-1 text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      </span>
    </li>
  );
}

function Setinha({
  rotulo,
  desativado,
  aoClicar,
  children,
}: {
  rotulo: string;
  desativado: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desativado}
      aria-label={rotulo}
      className="nx-cut-4 cursor-pointer p-1 text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground disabled:cursor-default disabled:opacity-25 disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}

function Interruptor({
  rotulo,
  ligado,
  aoAlternar,
}: {
  rotulo: string;
  ligado: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={aoAlternar}
      className="nx-cut-5 flex w-full cursor-pointer items-center gap-3 px-1.5 py-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)]"
    >
      <span className="flex-1 text-[13px] text-foreground">{rotulo}</span>
      <span
        aria-hidden
        className="nx-cut-4 relative h-[18px] w-[32px] shrink-0 transition-colors duration-[var(--duration-fast)]"
        style={{ background: ligado ? "var(--primary)" : "var(--nexodoc-recessed)" }}
      >
        <span
          className="nx-cut-4 absolute top-[3px] block h-[12px] w-[12px] transition-[left] duration-[var(--duration-fast)]"
          style={{
            left: ligado ? "17px" : "3px",
            background: ligado ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        />
      </span>
    </button>
  );
}

function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  empilhado,
  aoEscolher,
}: {
  rotulo: string;
  valor: string;
  opcoes: { id: T; rotulo: string }[];
  /** Opção comprida (as ordenações) vira coluna; as curtas ficam em linha. */
  empilhado?: boolean;
  aoEscolher: (v: T) => void;
}) {
  return (
    <div className="mt-1 px-1.5 py-2">
      <p className="m-0 mb-1.5 text-[13px] text-foreground">{rotulo}</p>
      <div
        className={cn(
          "nx-cut-5 gap-0.5 bg-[var(--nexodoc-recessed)] p-0.5",
          empilhado ? "flex flex-col" : "inline-flex items-center",
        )}
      >
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={valor === o.id}
            onClick={() => aoEscolher(o.id)}
            className={cn(
              "nx-cut-4 cursor-pointer px-2.5 py-1 font-mono text-[10.5px] tracking-[0.05em] transition-colors duration-[var(--duration-fast)]",
              empilhado ? "text-left" : "",
              valor === o.id
                ? "bg-[var(--secondary)] text-[var(--nexodoc-accent)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
