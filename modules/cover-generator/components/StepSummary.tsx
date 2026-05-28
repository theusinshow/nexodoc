"use client";

import type { CoverPage, GeneralData } from "../types";
import { Button } from "@/components/ui/button";
import { getFileName, formatDisplayCode, formatMesAno } from "../hooks/helpers";
import { ArrowLeft, CheckCircle } from "lucide-react";
import type { CoverTitleMode } from "@/lib/cover-utils";

interface StepSummaryProps {
  generalData: GeneralData;
  pages: CoverPage[];
  templateFields: string[];
  coverTitleMode: CoverTitleMode;
  onBack: () => void;
  onGenerate: () => void;
}

export function StepSummary({
  generalData,
  pages,
  templateFields,
  coverTitleMode,
  onBack,
  onGenerate,
}: StepSummaryProps) {
  const { codigoInterno, codigoExibido, siglaArquivo, revisao } = generalData;
  const displayCode = codigoExibido || formatDisplayCode(codigoInterno);
  const sigla = siglaArquivo || "";
  const rev = revisao || "r";
  const code = codigoInterno || "codigo";
  const showSecretaria =
    templateFields.length === 0 || templateFields.includes("SECRETARIA");
  const hasSeparateDiscipline = templateFields.includes("DISCIPLINA");
  const titleColumn = coverTitleMode === "volume-title-items"
    ? "Titulo do volume e itens"
    : hasSeparateDiscipline
      ? "Titulo fixo"
      : "Texto da capa / disciplinas";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resumo Final</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira todos os dados antes de gerar os arquivos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-card p-5 space-y-3">
          <h3 className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Arquivos
          </h3>
          <div className="space-y-1">
            <p className="font-mono text-sm">
              {getFileName(code, sigla, rev, "odt")}
            </p>
            <p className="font-mono text-sm">
              {getFileName(code, sigla, rev, "pdf")}
            </p>
            <p className="font-mono text-sm">
              {getFileName(code, sigla, rev, "zip")}
            </p>
          </div>
        </div>

        <div className="border border-border bg-card p-5 space-y-3">
          <h3 className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Totais
          </h3>
          <div className="space-y-1">
            <p className="text-sm">
              Total de capas: <span className="font-semibold tabular-nums">{pages.length}</span>
            </p>
            <p className="text-sm">
              Codigo:{" "}
              <span className="font-semibold">{displayCode || "-"}</span>
            </p>
            {generalData.mes && (
              <p className="text-sm">
                Periodo:{" "}
                <span className="font-semibold">
                  {formatMesAno(generalData.mes, generalData.ano)}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="sm:col-span-2 border border-border bg-card p-5 space-y-3">
          <h3 className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Dados do Projeto
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Orgao: </span>
              <span className="font-medium">{generalData.orgao || "-"}</span>
            </div>
            {showSecretaria && (
              <div>
                <span className="text-muted-foreground">Secretaria: </span>
                <span className="font-medium">
                  {generalData.secretaria || "-"}
                </span>
              </div>
            )}
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Obra: </span>
              <span className="font-medium">{generalData.nomeObra || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Fase: </span>
              <span className="font-medium">{generalData.fase || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Revisao: </span>
              <span className="font-medium">
                {generalData.revisao || "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Lista de capas ({pages.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="h-10 px-4 text-left font-mono text-xs text-muted-foreground w-16">
                  Pag.
                </th>
                <th className="h-10 px-4 text-left font-mono text-xs text-muted-foreground">
                  {titleColumn}
                </th>
                {hasSeparateDiscipline && (
                  <th className="h-10 px-4 text-left font-mono text-xs text-muted-foreground w-40">
                    Disciplinas
                  </th>
                )}
                <th className="h-10 px-4 text-left font-mono text-xs text-muted-foreground w-24">
                  Tomo
                </th>
                <th className="h-10 px-4 text-left font-mono text-xs text-muted-foreground w-20">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border">
                  <td className="p-4 font-mono text-xs tabular-nums text-muted-foreground">
                    {String(page.pageNumber).padStart(2, "0")}
                  </td>
                  <td className="p-4 text-sm whitespace-pre-wrap">{page.tituloCapa}</td>
                  {hasSeparateDiscipline && (
                    <td className="p-4 text-xs whitespace-pre-wrap text-muted-foreground">{page.disciplina || "-"}</td>
                  )}
                  <td className="p-4 text-xs">{page.tomo || "-"}</td>
                  <td className="p-4 text-xs">{page.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onGenerate}>
          <CheckCircle className="mr-1.5 h-4 w-4" />
          Gerar Capas
        </Button>
      </div>
    </div>
  );
}
