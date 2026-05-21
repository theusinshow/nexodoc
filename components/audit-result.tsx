"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutList,
  MapPin,
  Search,
} from "lucide-react";
import { useState } from "react";

import { AuditResultActions } from "@/components/audit-result-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AuditResultProps = {
  content: string;
  elapsedMs?: number;
};

type AuditSectionKey =
  | "project"
  | "status"
  | "memorial"
  | "drawings"
  | "findings"
  | "conclusion";

type ParsedAudit = Record<AuditSectionKey, string>;

type StructuredFinding = {
  title: string;
  documento?: string;
  pagina?: string;
  local?: string;
  evidencia?: string;
  conflito?: string;
  acao?: string;
  raw: string;
};

const SECTION_MAP: Record<string, AuditSectionKey> = {
  "projeto analisado": "project",
  "status geral": "status",
  memorial: "memorial",
  pranchas: "drawings",
  "incongruências relevantes encontradas": "findings",
  "incongruencias relevantes encontradas": "findings",
  "conclusão objetiva": "conclusion",
  "conclusao objetiva": "conclusion",
};

const EMPTY_AUDIT: ParsedAudit = {
  project: "",
  status: "",
  memorial: "",
  drawings: "",
  findings: "",
  conclusion: "",
};

function normalizeHeading(value: string) {
  return value.trim().toLowerCase();
}

function parseAuditResult(content: string): ParsedAudit {
  const parsed = { ...EMPTY_AUDIT };
  const sectionRegex =
    /(?:^|\n)\s*(\d+)\.\s*(Projeto analisado|Status geral|Memorial|Pranchas|Incongruências relevantes encontradas|Incongruencias relevantes encontradas|Conclusão objetiva|Conclusao objetiva)\s*\n/gi;
  const matches = Array.from(content.matchAll(sectionRegex));

  matches.forEach((match, index) => {
    const key = SECTION_MAP[normalizeHeading(match[2] ?? "")];
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? content.length)
        : content.length;

    if (key) {
      parsed[key] = content.slice(start, end).trim();
    }
  });

  return parsed;
}

function getStatusVariant(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("incongruência relevante")) {
    return {
      label: "com incongruência relevante",
      className:
        "border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
      icon: AlertTriangle,
    };
  }

  if (normalized.includes("ponto de atenção")) {
    return {
      label: "com ponto de atenção",
      className:
        "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
      icon: AlertTriangle,
    };
  }

  return {
    label: "sem incongruência relevante",
    className:
      "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
    icon: CheckCircle2,
  };
}

function formatElapsedTime(elapsedMs?: number) {
  if (!elapsedMs) {
    return null;
  }

  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `${seconds}s`;
}

function getFindingField(block: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:-\\s*)?${escapedLabel}\\s*:\\s*(.+?)(?=\\n\\s*(?:-\\s*)?(?:Documento|Página provável|Pagina provavel|Local|Evidência|Evidencia|Conflito|Ação recomendada|Acao recomendada)\\s*:|$)`,
    "is",
  );
  return block.match(regex)?.[1]?.trim();
}

function splitFindings(findings: string): StructuredFinding[] {
  const normalized = findings.trim();

  if (!normalized) {
    return [];
  }

  const structuredBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => /Documento\s*:|Página provável\s*:|Pagina provavel\s*:/i.test(block));

  if (structuredBlocks.length > 0) {
    return structuredBlocks.map((block, index) => ({
      title:
        block
          .split("\n")[0]
          ?.replace(/^[-•]\s*/, "")
          .replace(/^Achado\s*\d+\s*:\s*/i, "")
          .trim() || `Achado ${index + 1}`,
      documento: getFindingField(block, "Documento"),
      pagina:
        getFindingField(block, "Página provável") ??
        getFindingField(block, "Pagina provavel"),
      local: getFindingField(block, "Local"),
      evidencia:
        getFindingField(block, "Evidência") ??
        getFindingField(block, "Evidencia"),
      conflito: getFindingField(block, "Conflito"),
      acao:
        getFindingField(block, "Ação recomendada") ??
        getFindingField(block, "Acao recomendada"),
      raw: block,
    }));
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^[-•]\s*/, ""),
      raw: line,
      pagina: "não informada",
      local: "não informado",
      acao: index === 0 ? undefined : undefined,
    }));
}

function buildFindingsText(findings: StructuredFinding[]) {
  if (findings.length === 0) {
    return "Nenhuma incongruência relevante encontrada.";
  }

  return findings
    .map((finding, index) => {
      return [
        `${index + 1}. ${finding.title}`,
        finding.documento ? `Documento: ${finding.documento}` : null,
        finding.pagina ? `Página: ${finding.pagina}` : null,
        finding.local ? `Local: ${finding.local}` : null,
        finding.evidencia ? `Evidência: ${finding.evidencia}` : null,
        finding.conflito ? `Conflito: ${finding.conflito}` : null,
        finding.acao ? `Ação recomendada: ${finding.acao}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildActionsText(findings: StructuredFinding[]) {
  const actions = findings
    .map((finding) => finding.acao)
    .filter((value): value is string => Boolean(value));

  if (actions.length === 0) {
    return "Nenhuma ação recomendada identificada.";
  }

  return actions.map((action, index) => `${index + 1}. ${action}`).join("\n");
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-none border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export function AuditResult({ content, elapsedMs }: AuditResultProps) {
  const [view, setView] = useState<"analysis" | "report">("analysis");
  const parsed = parseAuditResult(content);
  const status = getStatusVariant(parsed.status);
  const StatusIcon = status.icon;
  const elapsed = formatElapsedTime(elapsedMs);
  const findings = splitFindings(parsed.findings);
  const findingsText = buildFindingsText(findings);
  const actionsText = buildActionsText(findings);

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <article className="w-full rounded-none border bg-card p-4">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Resultado da auditoria</Badge>
            {elapsed ? (
              <Badge variant="outline">Concluída em {elapsed}</Badge>
            ) : null}
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-none border px-3 py-2 text-sm font-medium",
              status.className,
            )}
          >
            <StatusIcon className="size-4" />
            {status.label}
          </div>
        </div>
        <AuditResultActions result={content} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={view === "analysis" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setView("analysis")}
        >
          Análise
        </Button>
        <Button
          type="button"
          variant={view === "report" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setView("report")}
        >
          Relatório
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyText(findingsText)}
        >
          Copiar achados
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyText(actionsText)}
        >
          Copiar ações
        </Button>
      </div>

      <div className="mt-4 grid gap-4">
        {view === "report" ? (
          <SectionCard title="Relatório da auditoria" icon={ClipboardCheck}>
            <div className="space-y-4 text-foreground">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Projeto
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {parsed.project || "Não identificado na resposta."}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-sm">{status.label}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Achados
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {findingsText}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Ações recomendadas
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {actionsText}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Conclusão
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {parsed.conclusion || "Sem conclusão identificada."}
                </pre>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {view === "analysis" ? (
          <>
        <SectionCard title="Projeto analisado" icon={ClipboardCheck}>
          <pre className="whitespace-pre-wrap break-words font-sans">
            {parsed.project || "Não identificado na resposta."}
          </pre>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Memorial" icon={FileText}>
            <pre className="whitespace-pre-wrap break-words font-sans">
              {parsed.memorial || "Sem informação específica."}
            </pre>
          </SectionCard>
          <SectionCard title="Pranchas" icon={LayoutList}>
            <pre className="whitespace-pre-wrap break-words font-sans">
              {parsed.drawings || "Sem informação específica."}
            </pre>
          </SectionCard>
        </div>

        <SectionCard title="Incongruências relevantes" icon={MapPin}>
          {findings.length > 0 ? (
            <ul className="space-y-2">
              {findings.map((finding, index) => (
                <li
                  key={`${finding.raw}-${index}`}
                  className="rounded-none border bg-background p-3"
                >
                  <div className="flex items-start gap-2">
                    <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {finding.title}
                      </p>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        {finding.documento ? (
                          <p>
                            <span className="font-medium text-foreground">
                              Documento:
                            </span>{" "}
                            {finding.documento}
                          </p>
                        ) : null}
                        {finding.pagina ? (
                          <p>
                            <span className="font-medium text-foreground">
                              Página:
                            </span>{" "}
                            {finding.pagina}
                          </p>
                        ) : null}
                        {finding.local ? (
                          <p>
                            <span className="font-medium text-foreground">
                              Local:
                            </span>{" "}
                            {finding.local}
                          </p>
                        ) : null}
                      </div>
                      {finding.evidencia ? (
                        <p className="mt-2 text-xs">
                          <span className="font-medium text-foreground">
                            Evidência:
                          </span>{" "}
                          {finding.evidencia}
                        </p>
                      ) : null}
                      {finding.conflito ? (
                        <p className="mt-2 text-xs">
                          <span className="font-medium text-foreground">
                            Conflito:
                          </span>{" "}
                          {finding.conflito}
                        </p>
                      ) : null}
                      {finding.acao ? (
                        <p className="mt-2 text-xs">
                          <span className="font-medium text-foreground">
                            Ação recomendada:
                          </span>{" "}
                          {finding.acao}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma incongruência relevante encontrada.</p>
          )}
        </SectionCard>

        <SectionCard title="Ações recomendadas" icon={CheckCircle2}>
          <pre className="whitespace-pre-wrap break-words font-sans">
            {actionsText}
          </pre>
        </SectionCard>

        <SectionCard title="Conclusão objetiva" icon={CheckCircle2}>
          <pre className="whitespace-pre-wrap break-words font-sans">
            {parsed.conclusion || "Sem conclusão identificada."}
          </pre>
        </SectionCard>
          </>
        ) : null}
      </div>
    </article>
  );
}
