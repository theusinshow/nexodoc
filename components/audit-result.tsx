import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutList,
  MapPin,
} from "lucide-react";

import { AuditResultActions } from "@/components/audit-result-actions";
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
        "border-destructive/30 bg-destructive/10 text-destructive",
      icon: AlertTriangle,
    };
  }

  if (normalized.includes("ponto de atenção")) {
    return {
      label: "com ponto de atenção",
      className:
        "border-amber-300 bg-amber-50 text-amber-800",
      icon: AlertTriangle,
    };
  }

  return {
    label: "sem incongruência relevante",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800",
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

function splitFindings(findings: string) {
  return findings
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•]\s*/, ""));
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
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export function AuditResult({ content, elapsedMs }: AuditResultProps) {
  const parsed = parseAuditResult(content);
  const status = getStatusVariant(parsed.status);
  const StatusIcon = status.icon;
  const elapsed = formatElapsedTime(elapsedMs);
  const findings = splitFindings(parsed.findings);

  return (
    <article className="w-full rounded-lg border bg-card p-4 shadow-xs">
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
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
              status.className,
            )}
          >
            <StatusIcon className="size-4" />
            {status.label}
          </div>
        </div>
        <AuditResultActions result={content} />
      </div>

      <div className="mt-4 grid gap-4">
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
                  key={`${finding}-${index}`}
                  className="rounded-md border bg-background px-3 py-2"
                >
                  {finding}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma incongruência relevante encontrada.</p>
          )}
        </SectionCard>

        <SectionCard title="Conclusão objetiva" icon={CheckCircle2}>
          <pre className="whitespace-pre-wrap break-words font-sans">
            {parsed.conclusion || "Sem conclusão identificada."}
          </pre>
        </SectionCard>
      </div>
    </article>
  );
}
