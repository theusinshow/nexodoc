import type { TemplateConfig } from "./types";

/**
 * Templates fallback.
 * A lista oficial de templates e carregada dinamicamente da pasta
 * templates/capas/* /config.json via API /api/capas/templates.
 * Este array serve apenas como fallback/documentacao dos tipos.
 */
export const TEMPLATES: TemplateConfig[] = [];

export const MARKERS = [
  "{{ORGAO}}",
  "{{SECRETARIA}}",
  "{{NOME_OBRA}}",
  "{{FASE}}",
  "{{DISCIPLINA}}",
  "{{TITULO_CAPA}}",
  "{{TOMO}}",
  "{{VOLUME}}",
  "{{MES_ANO}}",
  "{{CODIGO_EXIBIDO}}",
] as const;

/*
 * Os meses vão IMPRESSOS na capa, pelo marcador `{{MES_ANO}}`.
 *
 * "MARCO" (sem cedilha) não é uma abreviação nem uma escolha de estilo: é um
 * erro de português num documento entregue a uma prefeitura. Nenhuma coluna do
 * banco guarda este valor, então corrigir não invalida rascunho nenhum.
 */
export const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

export const VOLUME_OPTIONS_ROMAN = [
  { value: "I", label: "Vol. I" },
  { value: "II", label: "Vol. II" },
  { value: "III", label: "Vol. III" },
  { value: "IV", label: "Vol. IV" },
  { value: "V", label: "Vol. V" },
  { value: "VI", label: "Vol. VI" },
  { value: "VII", label: "Vol. VII" },
  { value: "VIII", label: "Vol. VIII" },
  { value: "IX", label: "Vol. IX" },
  { value: "X", label: "Vol. X" },
] as const;

export const VOLUME_OPTIONS_NUMERIC = [
  { value: "1", label: "Volume 1" },
  { value: "2", label: "Volume 2" },
  { value: "3", label: "Volume 3" },
  { value: "4", label: "Volume 4" },
  { value: "5", label: "Volume 5" },
  { value: "6", label: "Volume 6" },
  { value: "7", label: "Volume 7" },
  { value: "8", label: "Volume 8" },
  { value: "9", label: "Volume 9" },
  { value: "10", label: "Volume 10" },
] as const;

export const VOLUME_OPTIONS = VOLUME_OPTIONS_ROMAN;

export const FIELD_BASE =
  "flex w-full border border-input bg-[var(--nexodoc-recessed)] transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";

/**
 * Classe unica dos campos do modulo. A altura vem do global (min-height 40px em
 * globals.css) -- nao passe h-9/py-1 aqui (era codigo morto, o global vence).
 * Textareas adicionam apenas `min-h-[...] py-2` por cima.
 */
export const FIELD_CLASS = `${FIELD_BASE} px-3 text-sm`;

/** Rotulo mono-uppercase padrao dos campos (Mono Label do DESIGN.md). */
export const LABEL_CLASS =
  "font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground";
