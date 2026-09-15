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
import { leituraDoSeloVazia } from "./estado-do-anexo.ts";
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
/*
 * 2 (19/08/2026): a limpeza da descricao ganhou borda de palavra. Ate a versao
 * 1, o corte no rotulo vizinho casava `IMP` dentro de "IMPLANTACAO" e a coluna
 * DESCRICAO recebia "PLANTA DE". O texto cortado ficou GUARDADO aqui, entao sem
 * subir o numero as pranchas ja lidas voltariam da memoria erradas.
 *
 * 3 (15/09/2026, v2): a leitura vazia (JSON valido, todos os campos nulos)
 * passou a virar `extraction: null` com motivo, em vez do objeto truthy que
 * o cache guardava como "lido" — ver `leituraDoSeloVazia`. Sem subir o
 * numero, prancha ja lida por um build anterior ao conserto continuaria
 * voltando da memoria com o chip em branco.
 */
export const VERSAO_DO_LEITOR = 3;

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
export interface OpcoesDeConsulta {
  /**
   * IGNORA a leitura guardada e manda tudo para leitura nova.
   *
   * A memória é por conteúdo do arquivo, e é isso que a torna útil: a mesma
   * prancha renomeada acerta igual. Mas é também o que deixa o engenheiro sem
   * saída quando o que mudou NÃO foi o arquivo — o carimbo foi lido errado, ou
   * o desenho foi corrigido e reexportado byte a byte igual. Reanexar a prancha
   * devolvia, na hora, a mesma leitura de antes, e não havia nada na tela que
   * explicasse por quê.
   *
   * As CHAVES continuam sendo calculadas: a releitura entra por cima da
   * guardada, senão a correção valeria só desta vez e a próxima anexação
   * ressuscitaria a leitura velha.
   */
  ignorarMemoria?: boolean;
}

export async function consultarCache(
  files: readonly File[],
  opcoes: OpcoesDeConsulta = {},
): Promise<ConsultaAoCache> {
  const semCache: ConsultaAoCache = {
    acertos: [],
    ineditos: files.map((file) => ({ file, key: "" })),
  };
  if (files.length === 0) return { acertos: [], ineditos: [] };
  try {
    const chaves = await Promise.all(files.map((f) => chaveDoArquivo(f)));
    if (opcoes.ignorarMemoria) {
      return { acertos: [], ineditos: files.map((file, i) => ({ file, key: chaves[i] })) };
    }
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
  return results.map((r) => saneada({ ...semUsage(r), fileName }));
}

/**
 * SEGUNDA DEFESA contra a leitura vazia, independente de `VERSAO_DO_LEITOR`.
 *
 * A versão protege contra a MESMA chave voltar a servir leitura de um leitor
 * já corrigido — mas o cache é um IndexedDB local, e nada impede um registro
 * gravado por qualquer versão (inclusive uma futura, se algum conserto
 * esquecer de subir o número) de chegar aqui com um objeto de extração todo
 * nulo. Reler o que já está na mão custa zero: se o objeto é vazio pela
 * mesma regra do leitor (`leituraDoSeloVazia`), ele sai daqui já como não
 * lido — nunca como um "lido" em branco.
 */
function saneada(r: SeloResult): SeloResult {
  if (!leituraDoSeloVazia(r.extraction)) return r;
  return {
    ...r,
    extraction: null,
    error: r.error ?? "O carimbo voltou sem nenhum campo legível.",
    vazia: true,
  };
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
 * Só quando TODAS as folhas do documento estão presentes e nenhuma falhou DE
 * VERDADE. Meia leitura no cache seria pior que cache nenhum: o buraco
 * viraria permanente — toda vez que o arquivo voltasse, ele acertaria o
 * cache e as folhas que faltam nunca mais seriam lidas.
 *
 * `error` sozinho não decide mais: uma folha `vazia` (a chamada teve êxito,
 * o carimbo não trouxe nada — ver `leituraDoSeloVazia`) carrega `error` para
 * a tela avisar, mas reler não mudaria nada, e SEM guardá-la o mesmo PDF
 * pagava uma chamada de modelo a cada reanexação só para redescobrir o
 * carimbo em branco de sempre. Falha TRANSITÓRIA (rede, timeout) continua de
 * fora: essa pode sair diferente na próxima tentativa.
 *
 * Página PULADA (capa, separatriz, índice) conta como lida: pular é o
 * comportamento certo, é determinístico e não custou modelo nenhum.
 */
export function leituraCompleta(doArquivo: readonly SeloResult[]): boolean {
  if (doArquivo.length === 0) return false;
  const pageCount = doArquivo[0].pageCount;
  if (!pageCount || doArquivo.length !== pageCount) return false;
  if (doArquivo.some((r) => r.error && !r.vazia)) return false;
  // Uma folha lida sem extração e sem motivo (nem vazia, nem pulada) é
  // buraco silencioso — não entra.
  return doArquivo.every((r) => r.extraction !== null || r.ignorada || r.vazia);
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
