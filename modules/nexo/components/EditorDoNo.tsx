"use client";

/**
 * Editor de um documento DIRETO no nó do canvas.
 *
 * Abre a exceção à regra C1 do módulo ("o card é read-only, nunca formulário")
 * de propósito, com a condição que a torna segura: ao aplicar, a alteração
 * REGENERA o artefato E entra no histórico como mensagem do engenheiro. Sem
 * isso, o próximo turno do agente — que re-propõe a partir do histórico —
 * sobrescreveria a edição sem avisar, que é a razão da regra existir.
 *
 * Nenhum turno de IA é disparado aqui: gastaria tokens para reconfirmar o que o
 * engenheiro acabou de decidir. A mensagem existe para o PRÓXIMO turno enxergar.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NexoArtifactKind } from "../types";
import { descreverMudanca, type RotulosDeCampo } from "../lib/edicao";
import { CHAVES_DO_FRAME, FrameDaCapa, type DerivadosDaCapa } from "./FrameDaCapa";

/** Um campo do editor. `linhas > 1` vira textarea (título tem parágrafos). */
export interface CampoEditavel {
  chave: string;
  rotulo: string;
  valor: string;
  linhas?: number;
  /** Lista fechada (prefeitura); ausente = texto livre. */
  opcoes?: { valor: string; rotulo: string }[];
  /** Texto de aviso mostrado quando o campo é alterado (ex.: nº de tomos). */
  avisoAoMudar?: (valor: string) => string | null;
  /** Só leitura: a separatriz herda o título da capa e não o edita. */
  somenteLeitura?: boolean;
  /**
   * Agrupa o campo numa seção RECOLHIDA, com este título.
   *
   * Existe para os campos de identidade da capa (órgão, obra, código…): são o
   * escape de quando o carimbo mente, e o carimbo acerta quase sempre. Abertos,
   * seriam sete campos que ninguém precisa ler antes dos três que importam —
   * e transformariam o popover no formulário que a arquitetura evita.
   */
  grupo?: string;
  /** Ajuda do grupo, mostrada uma vez, quando ele é aberto. */
  ajudaDoGrupo?: string;
}

const LABEL_CLASS =
  "font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground";

export function EditorDoNo({
  kind,
  campos,
  onAplicar,
  onCancelar,
  prefeituraDoTemplate,
  rotuloDoTomo,
  derivadosDaCapa,
}: {
  kind: NexoArtifactKind;
  campos: CampoEditavel[];
  /** Cabeçalho da capa, do template escolhido. Só para desenhar o frame. */
  prefeituraDoTemplate?: string;
  /** "TOMO 01", derivado da divisão. Só para desenhar o frame. */
  rotuloDoTomo?: string;
  /**
   * O que o carimbo já diz (obra, código). Sem isto o frame desenha a capa
   * VAZIA nesses campos — eles chegam em branco de propósito, porque branco
   * significa "vale o selo".
   */
  derivadosDaCapa?: DerivadosDaCapa;
  /**
   * Aplica: recebe os valores novos e a FRASE para o histórico (`null` quando
   * nada mudou). Quem chama regenera o artefato e escreve a mensagem.
   */
  onAplicar: (
    valores: Record<string, string>,
    frase: string | null,
  ) => Promise<void>;
  onCancelar: () => void;
}) {
  const iniciais = Object.fromEntries(campos.map((c) => [c.chave, c.valor]));
  const [valores, setValores] = useState<Record<string, string>>(iniciais);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const rotulos: RotulosDeCampo = Object.fromEntries(
    campos.filter((c) => !c.somenteLeitura).map((c) => [c.chave, c.rotulo]),
  );
  const frase = descreverMudanca(iniciais, valores, rotulos);
  const semMudanca = frase === null;

  // Avisos dos campos que mudaram (ex.: "3 documentos vão sair da divisão").
  const avisos = campos
    .filter((c) => c.avisoAoMudar && valores[c.chave] !== iniciais[c.chave])
    .map((c) => c.avisoAoMudar!(valores[c.chave]))
    .filter((a): a is string => Boolean(a));

  async function aplicar() {
    setBusy(true);
    setErro(null);
    try {
      await onAplicar(valores, frase);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao aplicar.");
    } finally {
      setBusy(false);
    }
  }

  // Os campos soltos vêm primeiro; cada grupo vira uma seção recolhida no fim.
  const soltos = campos.filter((c) => !c.grupo);
  const grupos: { titulo: string; ajuda?: string; campos: CampoEditavel[] }[] = [];
  for (const c of campos) {
    if (!c.grupo) continue;
    const existente = grupos.find((g) => g.titulo === c.grupo);
    if (existente) existente.campos.push(c);
    else grupos.push({ titulo: c.grupo, ajuda: c.ajudaDoGrupo, campos: [c] });
  }

  const campo = (c: CampoEditavel) => (
    <label key={c.chave} className="block space-y-1">
          <span className={LABEL_CLASS}>{c.rotulo}</span>
          {c.somenteLeitura ? (
            <p className="whitespace-pre-line rounded-sm border border-border bg-[var(--nexodoc-recessed)] px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
              {c.valor || "—"}
            </p>
          ) : c.opcoes ? (
            <select
              value={valores[c.chave]}
              onChange={(e) =>
                setValores((v) => ({ ...v, [c.chave]: e.target.value }))
              }
              className="w-full rounded-sm border border-input bg-transparent px-2 py-1.5 font-mono text-[11px]"
            >
              {c.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          ) : (c.linhas ?? 1) > 1 ? (
            <textarea
              value={valores[c.chave]}
              rows={c.linhas}
              onChange={(e) =>
                setValores((v) => ({ ...v, [c.chave]: e.target.value }))
              }
              className="w-full resize-none rounded-sm border border-input bg-transparent px-2 py-1.5 font-mono text-[11px] leading-snug outline-none"
            />
          ) : (
            <input
              value={valores[c.chave]}
              onChange={(e) =>
                setValores((v) => ({ ...v, [c.chave]: e.target.value }))
              }
              className="w-full rounded-sm border border-input bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none"
            />
          )}
    </label>
  );

  /*
   * A CAPA é editada com a FORMA da capa, não como lista de rótulo/valor.
   *
   * O que se confere numa capa é o arranjo — quantas linhas tem a obra, se o
   * bairro ficou embaixo dela, se a disciplina tem três linhas. Uma lista de
   * campos esconde exatamente isso, e escondia também que dois desses campos são
   * MULTILINHA (cada Enter vira uma linha impressa).
   *
   * Os campos que o frame desenha saem da lista; o resto (prefeitura, tomos,
   * identidade) continua abaixo, onde sempre esteve.
   */
  const usaFrame = kind === "capa";
  const noFrame = usaFrame
    ? soltos.filter((c) => CHAVES_DO_FRAME.includes(c.chave))
    : [];
  const foraDoFrame = usaFrame
    ? soltos.filter((c) => !CHAVES_DO_FRAME.includes(c.chave))
    : soltos;
  const identidade = campos.filter((c) => c.grupo);
  const camposDoFrame = [...noFrame, ...identidade.filter((c) => CHAVES_DO_FRAME.includes(c.chave))];
  const gruposVisiveis = usaFrame
    ? grupos
        .map((g) => ({
          ...g,
          campos: g.campos.filter((c) => !CHAVES_DO_FRAME.includes(c.chave)),
        }))
        .filter((g) => g.campos.length > 0)
    : grupos;

  return (
    <div className="nodrag nopan nowheel space-y-2.5">
      <p className={LABEL_CLASS}>Editar {kind}</p>

      {usaFrame && (
        <FrameDaCapa
          campos={camposDoFrame}
          valores={valores}
          onChange={(chave, v) => setValores((atual) => ({ ...atual, [chave]: v }))}
          prefeitura={prefeituraDoTemplate ?? ""}
          derivados={derivadosDaCapa ?? {}}
          tomo={rotuloDoTomo ?? ""}
        />
      )}

      {foraDoFrame.map(campo)}

      {gruposVisiveis.map((g) => (
        <details key={g.titulo} className="rounded-sm border border-border">
          <summary className="cursor-pointer list-none px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground">
            {g.titulo}
          </summary>
          <div className="space-y-2 border-t border-border p-2">
            {g.ajuda && (
              <p className="text-[10px] leading-4 text-muted-foreground">{g.ajuda}</p>
            )}
            {g.campos.map(campo)}
          </div>
        </details>
      ))}

      {avisos.map((a) => (
        <p
          key={a}
          className="rounded-sm border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-2 py-1.5 text-[11px] text-[var(--status-warning)]"
        >
          {a}
        </p>
      ))}

      {erro && (
        <p role="alert" className="text-[11px] text-destructive">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <Button size="sm" onClick={aplicar} disabled={busy || semMudanca}>
          {busy && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />}
          {busy ? "Aplicando…" : "Aplicar"}
        </Button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-sm text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
