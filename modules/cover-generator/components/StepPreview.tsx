"use client";

import { GripVertical, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoverTitleMode } from "@/lib/cover-utils";
import { FIELD_BASE } from "../constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CoverPage, GeneralData } from "../types";
import { formatMesAno } from "../hooks/helpers";

interface StepPreviewProps {
  pages: CoverPage[];
  generalData: GeneralData;
  templateFields: string[];
  coverTitleMode: CoverTitleMode;
  onUpdate: (id: string, partial: Partial<CoverPage>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onReorder: (pages: CoverPage[]) => void;
  onBack: () => void;
  onNext: () => void;
}

const FIELD_CLASS = `${FIELD_BASE} px-2 py-1.5 text-xs`;

function getCoverLines(page: CoverPage, coverTitleMode: CoverTitleMode) {
  const lines = page.tituloCapa
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (coverTitleMode === "volume-title-items") {
    return {
      volumeTitle: lines[0] ?? "",
      items: lines.slice(1),
    };
  }

  return {
    volumeTitle: "",
    items: lines,
  };
}

function SortablePageRow({
  page,
  onUpdate,
  onRemove,
  showRemove,
  hasSeparateDiscipline,
  coverTitleMode,
  generalData,
}: {
  page: CoverPage;
  generalData: GeneralData;
  onUpdate: (id: string, partial: Partial<CoverPage>) => void;
  onRemove: (id: string) => void;
  showRemove: boolean;
  hasSeparateDiscipline: boolean;
  coverTitleMode: CoverTitleMode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid gap-4 border border-border bg-card p-4 transition-shadow lg:grid-cols-[240px_minmax(0,1fr)] ${
        isDragging ? "z-10 shadow-panel opacity-80" : ""
      }`}
    >
      <MiniCover
        page={page}
        generalData={generalData}
        coverTitleMode={coverTitleMode}
      />

      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Capa {String(page.pageNumber).padStart(2, "0")}
            </p>
            <p className="text-sm font-medium">
              {coverTitleMode === "volume-title-items"
                ? "Volume e itens da capa"
                : "Itens exibidos na capa"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              {...attributes}
              {...listeners}
              className="h-8 w-8 cursor-grab touch-none p-0 text-muted-foreground/60 hover:text-foreground"
              aria-label="Reordenar capa"
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            {showRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(page.id)}
                className="h-8 w-8 p-0 text-muted-foreground/60 hover:text-destructive"
                aria-label="Remover capa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_100px]">
          <div className="space-y-1.5 sm:col-span-3">
            <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              {coverTitleMode === "volume-title-items"
                ? "Primeira linha = titulo do volume; demais linhas = itens abaixo"
                : hasSeparateDiscipline
                  ? "Titulo fixo"
                  : "Itens da capa"}
            </label>
            <textarea
              className={`${FIELD_CLASS} min-h-[94px]`}
              value={page.tituloCapa}
              onChange={(e) => onUpdate(page.id, { tituloCapa: e.target.value })}
              placeholder={
                coverTitleMode === "volume-title-items"
                  ? "LEVANTAMENTO TOPOGRAFICO\nSONDAGEM\nPROJETO DE DRENAGEM"
                  : "PROJETO DE FUNDACOES\nPROJETO ESTRUTURAL EM CONCRETO"
              }
              rows={4}
            />
          </div>

          {hasSeparateDiscipline && (
            <div className="space-y-1.5 sm:col-span-3">
              <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Disciplinas
              </label>
              <textarea
                className={`${FIELD_CLASS} min-h-[70px]`}
                value={page.disciplina}
                onChange={(e) => onUpdate(page.id, { disciplina: e.target.value })}
                placeholder="Uma disciplina por linha"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Tomo
            </label>
            <input
              className={`${FIELD_CLASS} h-9`}
              value={page.tomo}
              onChange={(e) => onUpdate(page.id, { tomo: e.target.value })}
              placeholder="TOMO"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Volume
            </label>
            <input
              className={`${FIELD_CLASS} h-9`}
              value={page.volume}
              onChange={(e) => onUpdate(page.id, { volume: e.target.value })}
              placeholder="Vol."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCover({
  page,
  generalData,
  coverTitleMode,
}: {
  page: CoverPage;
  generalData: GeneralData;
  coverTitleMode: CoverTitleMode;
}) {
  const { volumeTitle, items } = getCoverLines(page, coverTitleMode);
  const mainItems = coverTitleMode === "volume-title-items" ? items : items;
  const [obra, localidade] = generalData.nomeObra
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const mesAno = formatMesAno(generalData.mes, generalData.ano);
  const codigo = generalData.codigoExibido || generalData.codigoInterno;

  return (
    <div className="mx-auto aspect-[210/297] w-full max-w-[220px] border border-border bg-card p-4 shadow-subtle">
      <div className="flex h-full flex-col text-center text-[8px] leading-tight text-muted-foreground">
        <div className="space-y-1 pt-1 font-semibold uppercase tracking-[0.16em]">
          <p>Estado de Santa Catarina</p>
          <p>Governo do Municipio</p>
        </div>

        <div className="mt-[42%] space-y-1">
          <p className="text-[11px] font-bold uppercase leading-snug text-foreground">
            {obra || "Nome da obra"}
          </p>
          <p className="text-[8px] uppercase text-muted-foreground">
            {localidade || "bairro / localidade"}
          </p>
        </div>

        <div className="mt-auto space-y-1 pb-10 text-right font-bold uppercase text-foreground">
          {coverTitleMode === "volume-title-items" ? (
            <p>
              Volume {page.volume || "-"} {volumeTitle && `- ${volumeTitle}`}
            </p>
          ) : (
            <p>{page.volume || "Volume"}</p>
          )}
          {mainItems.slice(0, 4).map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
          {page.tomo && <p>{page.tomo}</p>}
        </div>

        <div className="space-y-1 text-[8px] font-semibold text-muted-foreground">
          <p>{codigo || "Codigo"}</p>
          <p>{mesAno || "Mes/Ano"}</p>
          <p className="pt-1 text-[7px]">Projetos, Supervisao e Planejamento Ltda</p>
        </div>
      </div>
    </div>
  );
}

export function StepPreview({
  pages,
  generalData,
  templateFields,
  coverTitleMode,
  onUpdate,
  onRemove,
  onAdd,
  onReorder,
  onBack,
  onNext,
}: StepPreviewProps) {
  const hasSeparateDiscipline = templateFields.includes("DISCIPLINA");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(pages, oldIndex, newIndex));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Previa Editavel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise cada capa antes de gerar. Aqui voce pode ajustar tomos com
            disciplinas diferentes, reordenar ou adicionar uma capa avulsa.
          </p>
        </div>
        <Button variant="outline" onClick={onAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar capa
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center border border-border bg-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhuma capa na previa</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Volte e configure os grupos de capa para gerar a previa.
          </p>
        </div>
      ) : (
        <div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {pages.map((page) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    generalData={generalData}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    showRemove={pages.length > 1}
                    hasSeparateDiscipline={hasSeparateDiscipline}
                    coverTitleMode={coverTitleMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <Button disabled={pages.length === 0} onClick={onNext}>
          Continuar
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
