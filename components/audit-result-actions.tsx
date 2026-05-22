"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AuditResultActionsProps = {
  result: string;
  fileName?: string;
};

export function AuditResultActions({
  result,
  fileName = "nexodoc-auditoria.md",
}: AuditResultActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copiado" : "Copiar resposta"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
        <Download />
        Baixar .md
      </Button>
    </div>
  );
}
