"use client";

import { Plus, Trash2, Eye, ArrowLeft } from "lucide-react";
import type { CoverGroup } from "../types";
import { Button } from "@/components/ui/button";
import { VOLUME_OPTIONS_ROMAN, VOLUME_OPTIONS_NUMERIC, FIELD_CLASS, LABEL_CLASS } from "../constants";
import { formatVolume } from "../hooks/helpers";
import type { CoverTitleMode, VolumeFormat } from "@/lib/cover-utils";
import { DisciplineQuickPick } from "./DisciplineQuickPick";

interface StepCoverGroupsProps {
  groups: CoverGroup[];
  volumeFormat: VolumeFormat;
  templateFields: string[];
  coverTitleMode: CoverTitleMode;
  onAdd: () => void;
  onUpdate: (id: string, partial: Partial<CoverGroup>) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export function StepCoverGroups({
  groups,
  volumeFormat,
  templateFields,
  coverTitleMode,
  onAdd,
  onUpdate,
  onRemove,
  onBack,
  onGenerate,
}: StepCoverGroupsProps) {
  const volumeOptions = volumeFormat === "numeric" ? VOLUME_OPTIONS_NUMERIC : VOLUME_OPTIONS_ROMAN;
  const hasSeparateDiscipline = templateFields.includes("DISCIPLINA");
  const titleLabel = coverTitleMode === "volume-title-items"
    ? "Titulo do volume e itens da capa"
    : hasSeparateDiscipline
    ? "Titulo fixo da capa"
    : "Texto da capa / disciplinas";
  const titleHelp = coverTitleMode === "volume-title-items"
    ? "Primeira linha: texto que aparece depois de VOLUME. Linhas seguintes: itens complementares da capa."
    : hasSeparateDiscipline
    ? "Ex.: CONTRACAPA - PROJETO EXECUTIVO. As disciplinas ficam no campo abaixo."
    : "Este texto entra no marcador TITULO_CAPA. Para duas disciplinas na mesma capa, coloque uma por linha.";
  const totalCovers = groups.reduce((total, group) => {
    if (group.tomoMode === "quantity") {
      return total + Math.max(1, group.tomoQuantity || 1);
    }
    return total + group.tomoList.filter((t) => t.trim()).length;
  }, 0);
  const incompleteGroups = groups.filter((group) => {
    const hasTitle = group.tituloCapa.trim().length > 0;
    const hasTomos =
      group.tomoMode === "quantity"
        ? (group.tomoQuantity || 0) > 0
        : group.tomoList.some((t) => t.trim().length > 0);

    return !hasTitle || !hasTomos;
  });
  const canGenerate = totalCovers > 0 && incompleteGroups.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-[-0.01em]">Capas e tomos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um grupo para cada titulo de capa. Cada tomo dentro do grupo
            vira uma pagina no ODT final.
          </p>
        </div>
        <Button variant="outline" onClick={onAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhum grupo configurado</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Comece adicionando um grupo. Depois informe o titulo, o volume e se
            os tomos serao numerados automaticamente ou escritos manualmente.
          </p>
          <Button className="mt-5" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar primeiro grupo
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <div
              key={group.id}
              className="rounded-md border border-border bg-card p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className={LABEL_CLASS}>Grupo {index + 1}</span>
                {groups.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(group.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover grupo ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={LABEL_CLASS} htmlFor={`titulo-${group.id}`}>
                    {titleLabel}
                  </label>
                  <textarea
                    id={`titulo-${group.id}`}
                    className={`${FIELD_CLASS} min-h-[60px] py-2`}
                    value={group.tituloCapa}
                    onChange={(e) =>
                      onUpdate(group.id, { tituloCapa: e.target.value })
                    }
                    placeholder={
                      coverTitleMode === "volume-title-items"
                        ? "PROJETO DE FUNDACOES\nPROJETO DE ESTRUTURAS DE CONCRETO"
                        : hasSeparateDiscipline
                          ? "CONTRACAPA - PROJETO EXECUTIVO"
                          : "PROJETO DE FUNDACOES\nPROJETO ESTRUTURAL EM CONCRETO"
                    }
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">{titleHelp}</p>
                  {!hasSeparateDiscipline && (
                    <DisciplineQuickPick
                      value={group.tituloCapa}
                      onChange={(value) => onUpdate(group.id, { tituloCapa: value })}
                    />
                  )}
                </div>

                {hasSeparateDiscipline && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className={LABEL_CLASS} htmlFor={`disciplina-${group.id}`}>
                      Disciplinas desta capa
                      <span className="text-muted-foreground font-normal ml-1 normal-case">(uma por linha)</span>
                    </label>
                    <textarea
                      id={`disciplina-${group.id}`}
                      className={`${FIELD_CLASS} min-h-[60px] py-2`}
                      value={group.disciplina}
                      onChange={(e) =>
                        onUpdate(group.id, { disciplina: e.target.value })
                      }
                      placeholder={"PROJETO DE FUNDACOES\nPROJETO ESTRUTURAL EM CONCRETO"}
                      rows={3}
                    />
                    <DisciplineQuickPick
                      value={group.disciplina}
                      onChange={(value) => onUpdate(group.id, { disciplina: value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se cada tomo tiver disciplinas diferentes, gere a previa e
                      edite cada linha individualmente.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL_CLASS} htmlFor={`volume-${group.id}`}>
                    Volume
                  </label>
                  <select
                    id={`volume-${group.id}`}
                    className={FIELD_CLASS}
                    value={group.volume}
                    onChange={(e) =>
                      onUpdate(group.id, { volume: e.target.value })
                    }
                  >
                    {volumeOptions.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className={LABEL_CLASS}>
                    Como gerar os tomos
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={group.tomoMode === "quantity" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        onUpdate(group.id, { tomoMode: "quantity" })
                      }
                      className="flex-1"
                    >
                      Numerar por quantidade
                    </Button>
                    <Button
                      type="button"
                      variant={group.tomoMode === "list" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => onUpdate(group.id, { tomoMode: "list" })}
                      className="flex-1"
                    >
                      Informar lista
                    </Button>
                  </div>

                  {group.tomoMode === "quantity" ? (
                    <div className="space-y-1.5">
                      <label
                        className="font-mono text-xs text-muted-foreground"
                        htmlFor={`tomo-qtd-${group.id}`}
                      >
                        Quantidade de tomos
                      </label>
                      <input
                        id={`tomo-qtd-${group.id}`}
                        type="number"
                        min={1}
                        max={99}
                        className={FIELD_CLASS}
                        value={group.tomoQuantity}
                        onChange={(e) =>
                          onUpdate(group.id, {
                            tomoQuantity: Math.max(
                              1,
                              parseInt(e.target.value) || 1
                            ),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label
                        className="font-mono text-xs text-muted-foreground"
                        htmlFor={`tomo-lista-${group.id}`}
                      >
                        Lista de tomos (um por linha)
                      </label>
                      <textarea
                        id={`tomo-lista-${group.id}`}
                        className={`${FIELD_CLASS} min-h-[80px] py-2`}
                        value={group.tomoList.join("\n")}
                        onChange={(e) =>
                          onUpdate(group.id, {
                            tomoList: e.target.value.split("\n"),
                          })
                        }
                        placeholder={"01\n02\n03"}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {group.tomoMode === "quantity"
                    ? `${group.tomoQuantity} tomo(s)`
                    : `${group.tomoList.filter(t => t).length} tomo(s)`}
                  {" \u00B7 "}{formatVolume(group.volume, volumeFormat)}
                </span>
                {!group.tituloCapa.trim() && (
                  <span className="ml-auto text-destructive">
                    Informe o texto da capa.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-col items-end gap-1">
          {groups.length > 0 && !canGenerate && (
            <p className="font-mono text-xs text-muted-foreground">
              Complete o titulo e os tomos de cada grupo.
            </p>
          )}
          <Button disabled={!canGenerate} onClick={onGenerate}>
            <Eye className="mr-1.5 h-4 w-4" />
            Gerar previa ({totalCovers})
          </Button>
        </div>
      </div>
    </div>
  );
}
