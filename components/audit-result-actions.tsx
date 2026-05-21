"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AuditResultActionsProps = {
  result: string;
};

export function AuditResultActions({ result }: AuditResultActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copiado" : "Copiar resposta"}
    </Button>
  );
}
