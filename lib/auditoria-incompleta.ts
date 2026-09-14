/**
 * AUDITORIA INCOMPLETA: o parecer que não pode parecer inteiro.
 *
 * Em 14/09/2026 o 117_25 (218 páginas) saiu em produção com 10 achados. A
 * leitura do documento pela IA abortou e só as regras automáticas rodaram. O
 * veredito já rebaixava para "análise parcial", mas a CONTAGEM aparecia sozinha
 * no cartão, no nó do mapa e no palco, igual à de qualquer auditoria. Quem olhou
 * leu "este memorial tem 10 problemas". A corrida completa do mesmo documento,
 * na mesma madrugada, achou 56.
 *
 * Por isso a decisão mora num lugar só, e toda tela que mostra número de
 * achados passa por aqui. Tela nova que copiar a contagem crua repete o defeito.
 *
 * Módulo puro, sem React e sem alias: o servidor, o cliente e os testes em node
 * cru o importam igual.
 */
import { plural } from "./plural.ts";
import { paginasMudasPendentes } from "./resumo-do-esforco.ts";
import type { CoberturaDoArquivo } from "./audit-report.ts";

type PassadaIncompleta = { passada: string; motivo?: string };

/** O mínimo do parecer que a decisão lê. Parecer antigo pode não ter nada disto. */
export type ParecerParaIncompletude = {
  status_analise?: string | null;
  status_geral?: string | null;
  total_incongruencias?: number | null;
  incongruencias?: readonly unknown[] | null;
  runtime?: { passadas_incompletas?: readonly PassadaIncompleta[] | null } | null;
  arquivos_analisados?: readonly { paginas?: number; cobertura?: CoberturaDoArquivo }[] | null;
};

export type Incompletude = {
  incompleta: boolean;
  /** A leitura do documento pela IA não aconteceu: os achados são só de regra. */
  iaNaoLeu: boolean;
  /** Folhas com o texto desenhado que ninguém transcreveu: a IA não as leu. */
  paginasNaoLidas: number;
  titulo: string;
  explicacao: string;
  passadas: PassadaIncompleta[];
};

/** A passada que lê o documento. Sem ela, a auditoria é só a camada de regra. */
export function ehLeituraDoDocumentoPelaIa(passada: string) {
  return passada.toLowerCase().includes("global");
}

function totalDeAchados(p: ParecerParaIncompletude) {
  return p.total_incongruencias ?? p.incongruencias?.length ?? 0;
}

export function incompletudeDoParecer(p: ParecerParaIncompletude): Incompletude {
  const passadas = [...(p.runtime?.passadas_incompletas ?? [])];
  const iaNaoLeu = passadas.some((x) => ehLeituraDoDocumentoPelaIa(x.passada));
  const parcial = p.status_analise === "parcial" || p.status_analise === "falha";
  const incompleta = passadas.length > 0 || parcial;
  const achados = plural(totalDeAchados(p), "achado", "achados");
  const arquivos = p.arquivos_analisados ?? [];
  const paginasNaoLidas = arquivos.reduce(
    (soma, a) => soma + (a.cobertura ? paginasMudasPendentes(a.cobertura) : 0),
    0,
  );
  const paginasTotais = arquivos.reduce((soma, a) => soma + (a.paginas ?? 0), 0);

  if (!incompleta) {
    return { incompleta, iaNaoLeu, paginasNaoLidas, titulo: "", explicacao: "", passadas };
  }

  if (iaNaoLeu) {
    const motivo = passadas.find((x) => ehLeituraDoDocumentoPelaIa(x.passada))?.motivo;
    return {
      incompleta,
      iaNaoLeu,
      paginasNaoLidas,
      titulo: "AUDITORIA INCOMPLETA — A IA NÃO LEU O DOCUMENTO",
      explicacao:
        `A leitura do documento pela IA falhou${motivo ? ` (${motivo})` : ""}. ` +
        `Os ${achados} deste parecer vieram só das regras automáticas. ` +
        "Esse número não é o total de problemas do documento: a maior parte do que a " +
        "auditoria encontra vem da leitura da IA, e ela não aconteceu. " +
        "Não use este parecer para emitir. Rode a auditoria de novo.",
      passadas,
    };
  }

  /*
   * FOLHA MUDA É O CASO MAIS COMUM, e o que a frase genérica pior explicava.
   * Em 14/09/2026 17:49 o 117_25 foi auditado sem transcrever as 14 folhas
   * desenhadas: a IA leu todo o texto, deu 52 achados, e o aviso dizia só
   * "parte do documento não foi lida". Quem leu não sabia o que faltou nem
   * como resolver.
   */
  if (paginasNaoLidas > 0 && passadas.length === 0) {
    const folhas = paginasTotais > 0 ? `${paginasNaoLidas} de ${paginasTotais} páginas` : plural(paginasNaoLidas, "página", "páginas");
    return {
      incompleta,
      iaNaoLeu,
      paginasNaoLidas,
      titulo: `AUDITORIA INCOMPLETA — ${plural(paginasNaoLidas, "PÁGINA NÃO FOI LIDA", "PÁGINAS NÃO FORAM LIDAS")}`,
      explicacao:
        `${folhas} deste documento têm o conteúdo desenhado na folha, e não escrito, ` +
        "e não foram transcritas: a IA não leu essas páginas. " +
        `Os ${achados} valem para o resto do documento, mas não cobrem essas páginas. ` +
        "Rode de novo com \"Transcrever e auditar\" antes de decidir.",
      passadas,
    };
  }

  const quais = passadas.map((x) => x.passada).join("; ");
  return {
    incompleta,
    iaNaoLeu,
    paginasNaoLidas,
    titulo: "AUDITORIA INCOMPLETA",
    explicacao:
      (quais
        ? `Uma etapa da análise não completou (${quais}). `
        : "Parte do documento não foi lida. ") +
      `Os ${achados} deste parecer valem, mas não são o total: ` +
      "a ausência de outros não significa que não existam. " +
      "Rode a auditoria de novo antes de decidir.",
    passadas,
  };
}

/** "10 achados", ou "10 achados — contagem INCOMPLETA". Nunca o número sozinho. */
export function rotuloDaContagem(p: ParecerParaIncompletude) {
  const base = plural(totalDeAchados(p), "achado", "achados");
  return incompletudeDoParecer(p).incompleta ? `${base} — contagem INCOMPLETA` : base;
}

/**
 * A linha curta do nó da auditoria no mapa e do resumo da conversa. Era
 * `${status_geral} · N achado(s)` copiado em cinco lugares, e nenhum avisava.
 */
export function detalheDoParecer(p: ParecerParaIncompletude) {
  const i = incompletudeDoParecer(p);
  if (!i.incompleta) {
    return `${p.status_geral ?? "auditoria"} · ${rotuloDaContagem(p)}`;
  }
  return `${i.titulo} · ${rotuloDaContagem(p)}`;
}

/** O resumo curto da auditoria na conversa ("Auditoria — ..."). */
export function resumoDoParecer(p: ParecerParaIncompletude) {
  const i = incompletudeDoParecer(p);
  return `Auditoria — ${i.incompleta ? i.titulo : (p.status_geral ?? "concluída")}`;
}
