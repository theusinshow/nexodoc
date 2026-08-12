"use client";

/**
 * Baixar os EDITÁVEIS do conjunto num ZIP só.
 *
 * O PDF é o que se envia; o ODT é o que se conserta. Cada card já oferecia o
 * seu, e num volume de seis tomos com capa, LD e separatriz por bloco isso são
 * dezenas de cliques para juntar o material que o escritório abre no LibreOffice
 * quando precisa mexer numa vírgula.
 *
 * O ZIP é montado no CLIENTE porque os arquivos já estão no cliente: eles vivem
 * como object URLs do artifact-store desde que foram gerados. Pedi-los de volta
 * ao servidor seria trafegar de novo o que já está em mãos.
 */

import type { SavedResult } from "../state/conversation-store";

export const ODT_MIME = "application/vnd.oasis.opendocument.text";

/** Um editável do conjunto, já com o nome que ele terá dentro do ZIP. */
export interface Editavel {
  nome: string;
  url: string;
}

/** As pastas do ZIP, uma por tipo de documento. */
const PASTA: Record<string, string> = {
  capa: "capas",
  ld: "lds",
  separatriz: "separatrizes",
};

/**
 * Os editáveis de um conjunto de resultados, agrupados POR TIPO.
 *
 * O ZIP sai com `capas/`, `lds/` e `separatrizes/` em vez de trinta arquivos
 * soltos na raiz: quem abre isso vai atrás de "as capas" ou "as LDs", nunca de
 * um documento específico no meio da pilha.
 *
 * Nome repetido não apaga arquivo em silêncio. Dois tomos geram "ld.odt" e
 * "ld.odt"; o desempate usa o RÓTULO do card, que já carrega o tomo, e só cai
 * no sufixo numérico quando nem isso basta. Agrupar por pasta reduz as colisões
 * mas não as elimina — dois tomos põem duas LDs na MESMA pasta.
 */
export function editaveisDosResultados(results: readonly SavedResult[]): Editavel[] {
  const saida: Editavel[] = [];
  const usados = new Map<string, number>();

  for (const r of results) {
    for (const f of r.files ?? []) {
      if (f.mime !== ODT_MIME) continue;
      const pasta = PASTA[r.kind] ?? "outros";
      const rotulo = (r.summary ?? "").trim();
      let nome = `${pasta}/${f.name}`;
      if (usados.has(nome)) {
        const ponto = nome.lastIndexOf(".");
        const base = ponto > 0 ? nome.slice(0, ponto) : nome;
        const ext = ponto > 0 ? nome.slice(ponto) : "";
        const marca = rotulo ? rotulo.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) : "";
        nome = marca ? `${base}--${marca}${ext}` : `${base}-${usados.get(nome)! + 1}${ext}`;
      }
      usados.set(`${pasta}/${f.name}`, (usados.get(`${pasta}/${f.name}`) ?? 0) + 1);
      // O nome desempatado também precisa entrar no mapa, senão dois cards com o
      // MESMO rótulo voltariam a colidir.
      usados.set(nome, (usados.get(nome) ?? 0) + 1);
      saida.push({ nome, url: f.url });
    }
  }
  return saida;
}

/**
 * Junta os editáveis num ZIP e dispara o download. Devolve quantos entraram.
 *
 * `jszip` entra por import DINÂMICO: ele só é necessário quando alguém clica, e
 * carregá-lo no bundle da página faria toda conversa pagar por um recurso que a
 * maioria não usa.
 */
export async function baixarEditaveis(
  editaveis: readonly Editavel[],
  nomeDoZip: string,
): Promise<number> {
  return baixarArquivosEmZip(editaveis, nomeDoZip);
}

/**
 * Junta arquivos quaisquer num ZIP e dispara o download.
 *
 * Genérico porque os VOLUMES montados precisam do mesmo empacotamento e têm o
 * mesmo formato ({nome, url}) — o que muda é só o que entra.
 *
 * Falha de leitura NÃO gera ZIP parcial. Os bytes dos artefatos vivem como
 * object URL no navegador: numa conversa reaberta noutra máquina, ou com o cache
 * limpo, a URL morre e o arquivo some sem erro visível. Entregar um ZIP com sete
 * dos oito volumes é o pior desfecho possível aqui, porque ninguém confere a
 * contagem antes de mandar para a prefeitura. Então tudo é lido ANTES de zipar,
 * e uma falha aborta com os nomes do que faltou.
 */
export async function baixarArquivosEmZip(
  arquivos: readonly Editavel[],
  nomeDoZip: string,
): Promise<number> {
  if (arquivos.length === 0) return 0;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const lidos: { nome: string; blob: Blob }[] = [];
  const faltando: string[] = [];

  for (const a of arquivos) {
    try {
      const resposta = await fetch(a.url);
      if (!resposta.ok) {
        faltando.push(a.nome);
        continue;
      }
      lidos.push({ nome: a.nome, blob: await resposta.blob() });
    } catch {
      // object URL revogado (recarregou a página, outra máquina, cache limpo)
      faltando.push(a.nome);
    }
  }

  if (faltando.length > 0) {
    throw new Error(
      `${faltando.length} arquivo(s) não estão disponíveis neste navegador e precisam ser gerados de novo aqui: ${faltando.join(", ")}. Nada foi baixado.`,
    );
  }

  for (const l of lidos) {
    zip.file(l.nome, l.blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoZip.toLowerCase().endsWith(".zip") ? nomeDoZip : `${nomeDoZip}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revogar já: o clique é síncrono e o blob pode passar de 100 MB num volume
    // grande — segurá-lo na memória depois do download é vazamento puro.
    URL.revokeObjectURL(url);
  }
  return lidos.length;
}
