/**
 * CACHE DE LEITURA DE SELO, por conteúdo do arquivo.
 *
 * Ler o selo custa uma chamada de modelo POR PÁGINA. Subir as mesmas pranchas
 * numa conversa nova pagava tudo de novo para obter, folha por folha, o mesmo
 * resultado — o arquivo não mudou, o leitor não mudou, e ainda assim a fatura
 * subia. Este módulo é a memória disso.
 *
 * A chave é o CONTEÚDO (sha-256), não o nome nem a conversa: a mesma prancha
 * renomeada, vinda de outra pasta ou solta em outro projeto, acerta igual.
 *
 * O QUE ELE NÃO É: um armazenamento de arquivos. Os PDFs continuam sem
 * persistir (ver o cabeçalho de [[nexo-db.ts]]) — o que fica é o texto lido,
 * ~1 KB por folha.
 *
 * ENVELHECIMENTO. A chave carrega `VERSAO_DO_LEITOR`. Não há vencimento por
 * tempo nem botão de limpar: quando o leitor muda, a chave muda, nenhum acerto
 * é possível e tudo se relê sozinho. É a única forma de garantir que uma
 * correção no leitor alcance também os arquivos já vistos — o modo de falhar
 * caro aqui seria continuar servindo, em silêncio, a leitura de um leitor que
 * já se sabe errado.
 */
// Com extensão, como em [[group-conversations.ts]]: é o que deixa as partes
// puras deste módulo rodarem no node cru, no teste.
import { getSeloCache, putSeloCache } from "./nexo-db.ts";
import type { SeloResult } from "./selo-render.ts";

/**
 * A versão do LEITOR de selo.
 *
 * SUBA ESTE NÚMERO ao mexer em qualquer coisa que mude o que sai da leitura:
 * o prompt de extração, o modelo, a caixa do recorte, as âncoras da geometria
 * ou o preenchimento de título. Esquecer de subir faz o cache servir leitura
 * velha para arquivo já visto — e o sintoma aparece só semanas depois, num
 * projeto antigo que "voltou a errar o que já tinha sido corrigido".
 */
export const VERSAO_DO_LEITOR = 1;

/** Um arquivo sem leitura guardada, com a chave já calculada (não recalcular). */
export interface ArquivoInedito {
  file: File;
  key: string;
}

export interface ConsultaAoCache {
  /** Arquivos com leitura completa guardada — não abrem o pdf.js nem o modelo. */
  acertos: { file: File; results: SeloResult[] }[];
  ineditos: ArquivoInedito[];
}

/** `${sha-256 do conteúdo}:${versão do leitor}`. */
async function chaveDoArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}:${VERSAO_DO_LEITOR}`;
}

/**
 * Separa o que já foi lido antes do que é inédito.
 *
 * Falhar aqui NÃO é erro: sem `crypto.subtle` (contexto inseguro) ou com o
 * IndexedDB bloqueado, tudo vira inédito e o fluxo segue pagando o que sempre
 * pagou. Um cache que derruba a leitura é pior que cache nenhum.
 */
export async function consultarCache(files: readonly File[]): Promise<ConsultaAoCache> {
  const semCache: ConsultaAoCache = {
    acertos: [],
    ineditos: files.map((file) => ({ file, key: "" })),
  };
  if (files.length === 0) return { acertos: [], ineditos: [] };
  try {
    const chaves = await Promise.all(files.map((f) => chaveDoArquivo(f)));
    const guardadas = await getSeloCache(chaves);
    const acertos: ConsultaAoCache["acertos"] = [];
    const ineditos: ArquivoInedito[] = [];
    files.forEach((file, i) => {
      const entry = guardadas.get(chaves[i]);
      if (entry) acertos.push({ file, results: reidratar(entry.results, file.name) });
      else ineditos.push({ file, key: chaves[i] });
    });
    return { acertos, ineditos };
  } catch {
    return semCache;
  }
}

/**
 * O resultado guardado volta com o NOME DO ARQUIVO DE AGORA e sem `usage`.
 *
 * O nome porque a mesma prancha pode ter sido renomeada, e é por ele que a
 * folha se liga ao PDF em mãos. O `usage` porque token nenhum foi gasto nesta
 * leitura — deixá-lo faria a conta desta sessão cobrar de novo o que já foi
 * pago, e a fatura é justamente o lugar onde a economia precisa aparecer.
 */
export function reidratar(results: readonly SeloResult[], fileName: string): SeloResult[] {
  return results.map((r) => ({ ...semUsage(r), fileName }));
}

/** Cópia sem a contagem de tokens (ver `reidratar`). */
function semUsage(r: SeloResult): SeloResult {
  const copia = { ...r };
  delete copia.usage;
  return copia;
}

/**
 * A leitura deste arquivo pode ser guardada?
 *
 * Só quando TODAS as folhas do documento estão presentes e nenhuma falhou. Meia
 * leitura no cache seria pior que cache nenhum: o buraco viraria permanente —
 * toda vez que o arquivo voltasse, ele acertaria o cache e as folhas que faltam
 * nunca mais seriam lidas.
 *
 * Página PULADA (capa, separatriz, índice) conta como lida: pular é o
 * comportamento certo, é determinístico e não custou modelo nenhum.
 */
export function leituraCompleta(doArquivo: readonly SeloResult[]): boolean {
  if (doArquivo.length === 0) return false;
  const pageCount = doArquivo[0].pageCount;
  if (!pageCount || doArquivo.length !== pageCount) return false;
  if (doArquivo.some((r) => r.error)) return false;
  // Uma folha lida sem extração e sem motivo é buraco silencioso — não entra.
  return doArquivo.every((r) => r.extraction !== null || r.ignorada);
}

/**
 * Guarda a leitura dos arquivos INÉDITOS que ficaram completas.
 *
 * "Completa" = todas as folhas do documento presentes e nenhuma com erro. Uma
 * leitura que quebrou no meio não entra: guardá-la congelaria o buraco, e a
 * retomada dentro da conversa (o conjunto `jaLidas`) já cobre esse caso.
 *
 * Best-effort de ponta a ponta — nada aqui pode derrubar uma leitura que já
 * custou uma chamada por página.
 */
export async function guardarNoCache(
  ineditos: readonly ArquivoInedito[],
  resultados: readonly SeloResult[],
): Promise<void> {
  if (ineditos.length === 0) return;
  const porArquivo = new Map<string, SeloResult[]>();
  for (const r of resultados) {
    const lista = porArquivo.get(r.fileName);
    if (lista) lista.push(r);
    else porArquivo.set(r.fileName, [r]);
  }
  for (const { file, key } of ineditos) {
    if (!key) continue; // consulta falhou: não há chave em que gravar
    const doArquivo = porArquivo.get(file.name);
    if (!doArquivo || doArquivo.length === 0) continue;
    if (!leituraCompleta(doArquivo)) continue;
    const pageCount = doArquivo[0].pageCount;
    try {
      await putSeloCache({
        key,
        fileName: file.name,
        pageCount,
        results: doArquivo.map(semUsage),
        savedAt: Date.now(),
      });
    } catch {
      // Disco cheio ou armazenamento bloqueado. A leitura desta vez valeu;
      // a próxima paga de novo, e é só isso.
    }
  }
}
