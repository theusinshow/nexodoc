/**
 * O TEXTO DO MEMORIAL, GUARDADO — para o chat poder RELER.
 *
 * Até 24/08/2026 a auditoria extraía o texto por corrida e o descartava: no
 * banco sobrava `AuditFile.extractedCharCount`, e os bytes do PDF ficavam no
 * navegador (`lib/file-storage.ts` está em "none"). O chat pós-parecer nunca
 * tinha visto o documento — respondia de cor sobre o JSON dos achados, e o
 * prompt dele mandava literalmente "não diga que releu o PDF". Nenhum ajuste de
 * prompt resolveria isso.
 *
 * Guardamos o TEXTO e não o PDF, e o índice de capítulos SEM o texto: o texto
 * do capítulo se reconstrói das páginas, e duplicá-lo dobraria o armazenamento
 * de graça. ~173 KB para um memorial de 73 páginas.
 *
 * Os imports são relativos e com extensão de propósito: este módulo é
 * importado por `node scripts/*.ts` sem bundler.
 */
import type { Prisma } from "@prisma/client";

import type { PaginaDeTexto } from "./ancoragem-de-evidencia.ts";
import { getPrisma, isDatabaseConfigured } from "./db.ts";
import { chunkPdfByChapter, textoDaPaginaParaIA, type ExtractedPdf } from "./pdf-text.ts";

export type CapituloGravado = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  chars: number;
};

export type MemoriaDoDocumento = {
  fileName: string;
  paginas: PaginaDeTexto[];
  capitulos: CapituloGravado[];
  charCount: number;
};

/**
 * PURO de propósito: a gravação acontece dentro de uma transação que já existe,
 * e o que decide o CONTEÚDO da linha precisa ser testável sem banco.
 */
export function memoriasDosArquivos(
  uploadedFiles: readonly { file: { name: string }; extracted: ExtractedPdf }[],
): MemoriaDoDocumento[] {
  const memorias: MemoriaDoDocumento[] = [];

  for (const item of uploadedFiles) {
    const pages = item.extracted?.pages ?? [];
    /*
     * Arquivo sem página não vira linha: uma memória vazia no banco faria o
     * chat acreditar que TEM o documento e responder "não consta" sobre tudo —
     * pior que o modo degradado, que ao menos avisa que não tem.
     */
    if (pages.length === 0) continue;

    /*
     * A página guardada é a que o MODELO lê — com a grade das tabelas anexada.
     * Guardar `page.text` cru devolveria a tabela como sopa de números, que é
     * exatamente o defeito que `textoDaPaginaParaIA` existe para consertar.
     */
    const paginas: PaginaDeTexto[] = pages.map((p) => ({
      page: p.page,
      text: textoDaPaginaParaIA(p),
    }));

    const capitulos: CapituloGravado[] = chunkPdfByChapter(item.extracted).map((c) => ({
      id: c.id,
      title: c.title,
      startPage: c.startPage,
      endPage: c.endPage,
      chars: c.text.length,
    }));

    memorias.push({
      fileName: item.file.name,
      paginas,
      capitulos,
      charCount: paginas.reduce((soma, p) => soma + p.text.length, 0),
    });
  }

  return memorias;
}

/** As linhas prontas para `createMany`, dentro da transação de quem chama. */
export function linhasDeAuditText(auditId: string, memorias: readonly MemoriaDoDocumento[]) {
  return memorias.map((m) => ({
    auditId,
    fileName: m.fileName,
    pages: m.paginas as unknown as Prisma.InputJsonValue,
    capitulos: m.capitulos as unknown as Prisma.InputJsonValue,
    charCount: m.charCount,
  }));
}

/**
 * O texto guardado desta auditoria.
 *
 * Vetor vazio = parecer antigo, gravado antes de a memória existir — e o chat
 * precisa DIZER isso na resposta, nunca fingir que leu. Falhar aqui também
 * devolve vazio: o chat cai no modo degradado em vez de morrer.
 */
export async function carregarMemoriaDoDocumento(auditId: string): Promise<MemoriaDoDocumento[]> {
  if (!auditId || !isDatabaseConfigured()) return [];

  try {
    const prisma = getPrisma();
    const linhas = await prisma.auditText.findMany({
      where: { auditId },
      orderBy: { createdAt: "asc" },
      select: { fileName: true, pages: true, capitulos: true, charCount: true },
    });

    return linhas.map((linha) => ({
      fileName: linha.fileName,
      paginas: (linha.pages as unknown as PaginaDeTexto[]) ?? [],
      capitulos: (linha.capitulos as unknown as CapituloGravado[]) ?? [],
      charCount: linha.charCount,
    }));
  } catch (error) {
    console.error("[audit-chat] falha ao ler a memória do documento", error);
    return [];
  }
}
