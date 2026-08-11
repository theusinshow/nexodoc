"use client";

/**
 * O DOCUMENTO COM A FORMA DO DOCUMENTO, desenhado a partir do MODELO.
 *
 * O frame anterior era um esqueleto em CSS fixo: descrevia a capa de Criciúma
 * como ela era num dia. Quem edita o modelo é o engenheiro — no dia seguinte o
 * modelo tinha duas linhas de nome de obra, e o esqueleto passou a mentir sem
 * que nada acusasse.
 *
 * Aqui a ordem, o alinhamento e o corpo saem do `content.xml`. Marcador vira
 * campo no lugar em que será impresso; texto fixo em volta continua texto;
 * marcador repetido vira UM campo com tantas linhas quantas as ocorrências,
 * porque é assim que `distribuirNosMarcadores` reparte o valor na geração.
 * Acrescentar um campo ao modelo passa a bastar — nada de código.
 *
 * Não é pré-visualização fiel (fonte e brasão são do ODT); é a ESTRUTURA, que é
 * o que se confere antes de gerar.
 */

import type { ParagrafoDoModelo } from "@/server/odt/layout";

export interface CampoDoFrame {
  /** Nome do marcador, ex. "NOME_OBRA". */
  marcador: string;
  rotulo: string;
  /** Ausente = editável. Presente = derivado; desenhado em cinza com a origem. */
  derivadoDe?: string;
  /** Força o número de linhas; senão vale o nº de ocorrências no modelo. */
  linhas?: number;
  placeholder?: string;
}

const ALINHAMENTO: Record<ParagrafoDoModelo["alinhamento"], string> = {
  start: "justify-start text-left",
  center: "justify-center text-center",
  end: "justify-end text-right",
};

/** Corpo do modelo (pt) → classe de tamanho. Relativo basta: é esqueleto. */
function classeDeCorpo(corpo: number | undefined): string {
  if (!corpo) return "text-xs";
  if (corpo >= 16) return "text-sm font-semibold";
  if (corpo >= 13) return "text-xs font-medium";
  return "text-[11px]";
}

export function FrameDoDocumento({
  layout,
  campos,
  valores,
  derivados = {},
  onChange,
}: {
  layout: ParagrafoDoModelo[];
  campos: CampoDoFrame[];
  /** Só o que foi DECIDIDO à mão. Vazio significa "vale o carimbo". */
  valores: Record<string, string>;
  /**
   * O que o carimbo/arquivo/divisão já dizem, por marcador. Entra como texto
   * FANTASMA nos campos editáveis, nunca como valor.
   *
   * Como valor, o campo não podia ser apagado: limpar devolvia "" ao estado, o
   * derivado reaparecia no mesmo render, e o controle brigava com quem digitava.
   * Fantasma preserva a regra "vazio = vale o carimbo" e ainda mostra o texto
   * já quebrado nas linhas em que vai sair impresso.
   */
  derivados?: Record<string, string>;
  onChange: (marcador: string, valor: string) => void;
}) {
  const campoDe = (marcador: string) => campos.find((c) => c.marcador === marcador);

  /*
   * Quantas vezes cada marcador aparece no modelo. O nome da obra ocupa DOIS
   * parágrafos, um por linha impressa — o campo tem de aparecer UMA vez, com
   * duas linhas. Desenhá-lo duas vezes faria o engenheiro digitar a obra duas
   * vezes para ver uma.
   */
  const ocorrencias = new Map<string, number>();
  for (const p of layout) {
    for (const parte of p.partes) {
      if (parte.tipo === "marcador") {
        ocorrencias.set(parte.nome, (ocorrencias.get(parte.nome) ?? 0) + 1);
      }
    }
  }

  const jaDesenhados = new Set<string>();

  return (
    <div className="nx-edge-8 p-4 [--nx-fill:var(--nexodoc-recessed)]">
      {layout.map((paragrafo) => {
        if (paragrafo.partes.length === 0) return null;

        return (
          <div
            key={paragrafo.indice}
            className={`flex flex-wrap items-baseline gap-1 py-0.5 ${
              ALINHAMENTO[paragrafo.alinhamento]
            }`}
          >
            {paragrafo.partes.map((parte, i) => {
              const chave = `${paragrafo.indice}-${i}`;

              if (parte.tipo === "texto") {
                return (
                  <span
                    key={chave}
                    className={`${classeDeCorpo(paragrafo.corpo)} whitespace-pre text-foreground`}
                  >
                    {parte.valor}
                  </span>
                );
              }

              if (parte.tipo === "quebrado") {
                /*
                 * O marcador que o LibreOffice partiu em spans. O gerador nunca
                 * o substituirá e ele sai LITERAL na capa — foi assim que
                 * `{{(TOMO)}}` chegou à produção sem nada acusar. Aqui é visível.
                 */
                return (
                  <span
                    key={chave}
                    role="alert"
                    /* Sem camada de contorno, pela mesma razao do badge: borda
                       E fundo sao translucidos, e numa camada o miolo comporia
                       sobre a cor da borda em vez de sobre a pagina. */
                    className="nx-cut-5 border-0 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive"
                  >
                    {parte.bruto} — marcador quebrado, conserte no modelo
                  </span>
                );
              }

              const campo = campoDe(parte.nome);
              // Marcador que o modelo tem e ninguém mapeou vira texto livre: é o
              // que torna verdadeira a promessa de que editar o ODT basta.
              const rotulo = campo?.rotulo ?? parte.nome;

              if (campo?.derivadoDe) {
                return (
                  <span
                    key={chave}
                    className="font-mono text-[10px] text-muted-foreground"
                    title={`${rotulo} · ${campo.derivadoDe}`}
                  >
                    {valores[parte.nome] || derivados[parte.nome] || "—"}
                    <span className="opacity-60"> · {campo.derivadoDe}</span>
                  </span>
                );
              }

              if (jaDesenhados.has(parte.nome)) return null;
              jaDesenhados.add(parte.nome);

              const linhas = campo?.linhas ?? ocorrencias.get(parte.nome) ?? 1;
              const comum =
                /* EXCECAO da spec do chanfro: campo tracejado do carimbo fica com raio de
       4px e borda tracejada. Tracejado nao sobrevive ao recorte, e aqui o
       tracejado e PAPEL, nao interface. O painel que os contem tem chanfro. */
    "min-w-0 flex-1 rounded-[4px] border border-dashed border-border bg-transparent px-1.5 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-solid focus:border-[var(--ring)] focus:bg-[var(--nexodoc-panel)]";
              const forma = `${classeDeCorpo(paragrafo.corpo)} ${
                ALINHAMENTO[paragrafo.alinhamento]
              }`;

              return linhas > 1 ? (
                <textarea
                  key={chave}
                  aria-label={rotulo}
                  rows={linhas}
                  value={valores[parte.nome] ?? ""}
                  placeholder={derivados[parte.nome] || campo?.placeholder}
                  onChange={(e) => onChange(parte.nome, e.target.value)}
                  className={`${comum} resize-none leading-snug ${forma}`}
                />
              ) : (
                <input
                  key={chave}
                  aria-label={rotulo}
                  value={valores[parte.nome] ?? ""}
                  placeholder={derivados[parte.nome] || campo?.placeholder}
                  onChange={(e) => onChange(parte.nome, e.target.value)}
                  className={`${comum} ${forma}`}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
