"use client";

/**
 * A CAPA COM A FORMA DA CAPA.
 *
 * Os campos eram uma lista de rótulo/valor: "Título", "Volume", "Mês", "Ano".
 * Preencher assim é imaginar como vai sair — e o que se confere numa capa é
 * justamente o ARRANJO: quantas linhas tem o nome da obra, se o bairro ficou
 * abaixo dele, se a disciplina tem três linhas ou uma.
 *
 * Aqui os mesmos campos são desenhados na posição em que serão impressos. Não é
 * uma pré-visualização fiel (fonte, corpo e brasão são do ODT); é o ESQUELETO,
 * o suficiente para o olho reconhecer o documento e ver o que falta.
 *
 * Os campos MULTILINHA são multilinha de verdade: cada Enter vira uma linha na
 * capa. É como o gerador já se comporta — `criciumaProjectNameXmlValue` divide o
 * nome da obra por quebra de linha, e o título da capa vira parágrafos — e a
 * lista de rótulo/valor escondia isso.
 */

import type { CampoEditavel } from "./EditorDoNo";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground";

/** As chaves que o frame desenha; o resto continua na lista abaixo dele. */
export const CHAVES_DO_FRAME = ["obra", "bairro", "volume", "tituloCapa", "mes", "ano"];

function Campo({
  campo,
  valor,
  onChange,
  className,
  placeholder,
  linhas,
}: {
  campo: CampoEditavel | undefined;
  valor: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  linhas?: number;
}) {
  if (!campo) return null;
  const base =
    "w-full rounded-sm border border-dashed border-border bg-transparent px-1.5 py-1 text-center outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-solid focus:border-[var(--ring)] focus:bg-[var(--nexodoc-recessed)]";
  return (linhas ?? 1) > 1 ? (
    <textarea
      aria-label={campo.rotulo}
      value={valor}
      rows={linhas}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${base} resize-none ${className ?? ""}`}
    />
  ) : (
    <input
      aria-label={campo.rotulo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${base} ${className ?? ""}`}
    />
  );
}

export function FrameDaCapa({
  campos,
  valores,
  onChange,
  prefeitura,
  codigo,
  tomo,
}: {
  campos: CampoEditavel[];
  valores: Record<string, string>;
  onChange: (chave: string, valor: string) => void;
  /** Cabeçalho fixo, do template escolhido — não se edita aqui. */
  prefeitura: string;
  /** Código do projeto, derivado. Aparece porque sai impresso. */
  codigo: string;
  /** Rótulo do tomo, derivado da divisão. */
  tomo: string;
}) {
  const de = (chave: string) => campos.find((c) => c.chave === chave);
  const valor = (chave: string) => valores[chave] ?? "";

  return (
    <div className="rounded-md border border-border bg-[var(--nexodoc-recessed)] p-4">
      {/* CABEÇALHO — vem do template. Editá-lo aqui seria editar o modelo. */}
      <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {prefeitura || "escolha a prefeitura"}
      </p>

      <div className="my-3 flex items-center justify-center">
        <span className="rounded-sm border border-dashed border-border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60">
          brasão do template
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <span className={LABEL}>Obra — cada Enter é uma linha</span>
          <Campo
            campo={de("obra")}
            valor={valor("obra")}
            onChange={(v) => onChange("obra", v)}
            linhas={2}
            placeholder={"REFORMA E AMPLIAÇÃO\nEMEB RUBENS DE ARRUDA RAMOS"}
            className="text-sm font-semibold"
          />
        </div>

        <div className="space-y-1">
          <span className={LABEL}>Bairro</span>
          <Campo
            campo={de("bairro")}
            valor={valor("bairro")}
            onChange={(v) => onChange("bairro", v)}
            placeholder="BAIRRO JARDIM MARISTELA"
            className="text-xs italic"
          />
        </div>

        <div className="flex items-start gap-2">
          <div className="w-24 shrink-0 space-y-1">
            <span className={LABEL}>Volume</span>
            <Campo
              campo={de("volume")}
              valor={valor("volume")}
              onChange={(v) => onChange("volume", v)}
              placeholder="auto"
              className="text-sm font-semibold"
            />
          </div>
          <div className="flex-1 space-y-1">
            <span className={LABEL}>Disciplinas — cada Enter é uma linha</span>
            <Campo
              campo={de("tituloCapa")}
              valor={valor("tituloCapa")}
              onChange={(v) => onChange("tituloCapa", v)}
              linhas={3}
              placeholder={"PROJETO DE URBANIZAÇÃO\nPROJETO DE PAISAGISMO\nMAQUETE ELETRÔNICA"}
              className="text-sm font-semibold"
            />
          </div>
        </div>

        {/* Derivados: saem impressos, mas não se digitam aqui. O tomo vem da
            divisão; o código, do carimbo (e corrige-se na Identidade). */}
        <div className="flex justify-center gap-4 pt-1">
          {tomo && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {tomo} <span className="opacity-60">· da divisão</span>
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {codigo || "—"} <span className="opacity-60">· do carimbo</span>
          </span>
        </div>

        <div className="mx-auto flex w-48 items-start gap-2">
          <div className="flex-1 space-y-1">
            <span className={LABEL}>Mês</span>
            <Campo
              campo={de("mes")}
              valor={valor("mes")}
              onChange={(v) => onChange("mes", v)}
              placeholder="auto"
              className="text-xs"
            />
          </div>
          <div className="flex-1 space-y-1">
            <span className={LABEL}>Ano</span>
            <Campo
              campo={de("ano")}
              valor={valor("ano")}
              onChange={(v) => onChange("ano", v)}
              placeholder="auto"
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
