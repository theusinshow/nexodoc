/**
 * A CONFERÊNCIA DE GRAFIA — lado do navegador (16/10/2026).
 *
 * Lê o texto de cada folha com o pdf.js, repara a fonte de CAD pelo mesmo
 * `repararTextoCad` da leitura de selo, tira a repetição do volume e manda as
 * linhas distintas para `/api/nexo/grafia-check`. Extrair não custa IA: é o que
 * permite mandar o volume INTEIRO em vez de uma amostra.
 *
 * A folha cuja prancha não está em mãos não some calada: ela conta no total, e
 * o resultado diz "grafia conferida em X de Y folhas".
 *
 * Desenho: docs/superpowers/specs/2026-10-16-grafia-nas-pranchas-design.md
 */
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  linhasUnicas,
  type ResultadoDaGrafia,
  type TextoDaFolha,
} from "@/server/nexo/grafia-core";
import { repararTextoCad } from "@/server/nexo/texto-cad";

import { baixarPrancha, type PranchaNaSessao } from "./pranchas-guardadas";
import { loadPdfjs } from "./selo-render";
import { conferirSessao } from "./sessao";

interface ItemCru {
  str?: unknown;
  fontName?: string;
}

/** O texto de UMA página, item a item, com o que veio de fonte reparada marcado. */
async function textoDaPagina(
  page: { getTextContent: () => Promise<{ items: unknown[] }> },
): Promise<TextoDaFolha["itens"]> {
  const content = await page.getTextContent();
  const brutos = (content.items as ItemCru[])
    .filter((i) => typeof i.str === "string" && i.str.trim())
    .map((i) => ({ texto: i.str as string, fonte: i.fontName ?? "" }));
  const { textos, marcaveis, fontesQuebradas } = repararTextoCad(brutos);
  const quebradas = new Set(fontesQuebradas.map((f) => f.fonte));
  const ilegiveis = new Set(marcaveis);
  return textos
    .map((texto, i) => ({ texto, recuperada: quebradas.has(brutos[i].fonte), i }))
    .filter((t) => !ilegiveis.has(t.i))
    .map(({ texto, recuperada }) => ({ texto, recuperada }));
}

/** O texto de todas as folhas lidas, na ordem dos selos. */
export async function textoDasFolhas(
  selos: readonly SeloForLd[],
  pranchas: readonly PranchaNaSessao[],
): Promise<TextoDaFolha[]> {
  const porNome = new Map(pranchas.map((p) => [p.name, p]));
  const paginasPorArquivo = new Map<string, number[]>();
  for (const s of selos) {
    if (!s.fileName) continue;
    const paginas = paginasPorArquivo.get(s.fileName) ?? [];
    const pagina = s.pageNumber ?? 1;
    if (!paginas.includes(pagina)) paginas.push(pagina);
    paginasPorArquivo.set(s.fileName, paginas);
  }

  const pdfjs = await loadPdfjs();
  const folhas: TextoDaFolha[] = [];
  for (const [arquivo, paginas] of paginasPorArquivo) {
    const prancha = porNome.get(arquivo);
    if (!prancha) continue;
    try {
      // Depois do F5 a prancha guardada não tem bytes na aba: baixa do cofre.
      const file =
        prancha.file ??
        (prancha.checksum ? await baixarPrancha({ name: prancha.name, checksum: prancha.checksum }) : null);
      if (!file) continue;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      try {
        for (const pagina of paginas) {
          if (pagina < 1 || pagina > doc.numPages) continue;
          const itens = await textoDaPagina(await doc.getPage(pagina));
          folhas.push({ arquivo, pagina, itens });
        }
      } finally {
        await doc.destroy();
      }
    } catch {
      // PDF que não abre fica fora da conta de lidas — e o total o denuncia.
    }
  }
  return folhas;
}

export async function conferirGrafia(args: {
  selos: SeloForLd[];
  pranchas: PranchaNaSessao[];
  conversationId?: string | null;
}): Promise<ResultadoDaGrafia> {
  const folhas = await textoDasFolhas(args.selos, args.pranchas);
  const { linhas, folhasLidas } = linhasUnicas(folhas);
  // O total é o das FOLHAS DO VOLUME, não o das que abriram: a que faltou conta.
  const folhasTotal = Math.max(
    folhas.length,
    new Set(args.selos.map((s) => `${s.fileName}#${s.pageNumber ?? 1}`)).size,
  );

  const res = await fetch("/api/nexo/grafia-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      linhas,
      folhasLidas,
      folhasTotal,
      conversationId: args.conversationId ?? null,
    }),
  });
  conferirSessao(res);
  const payload = (await res.json().catch(() => null)) as
    | { result?: ResultadoDaGrafia; error?: string }
    | null;
  if (!res.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Falha na conferência de grafia.");
  }
  return payload.result;
}
