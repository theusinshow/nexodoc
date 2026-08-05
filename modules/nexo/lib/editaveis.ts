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

/**
 * Os editáveis de um conjunto de resultados, sem repetição de nome.
 *
 * Dois tomos geram "ld.odt" e "ld.odt": num ZIP, o segundo apagaria o primeiro
 * em silêncio. O desempate usa o RÓTULO do card (que já carrega o tomo), e só
 * cai no sufixo numérico quando nem isso basta.
 */
export function editaveisDosResultados(results: readonly SavedResult[]): Editavel[] {
  const saida: Editavel[] = [];
  const usados = new Map<string, number>();

  for (const r of results) {
    for (const f of r.files ?? []) {
      if (f.mime !== ODT_MIME) continue;
      const rotulo = (r.summary ?? "").trim();
      let nome = f.name;
      if (usados.has(nome)) {
        const ponto = nome.lastIndexOf(".");
        const base = ponto > 0 ? nome.slice(0, ponto) : nome;
        const ext = ponto > 0 ? nome.slice(ponto) : "";
        const marca = rotulo ? rotulo.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) : "";
        nome = marca ? `${base}--${marca}${ext}` : `${base}-${usados.get(nome)! + 1}${ext}`;
      }
      usados.set(f.name, (usados.get(f.name) ?? 0) + 1);
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
  if (editaveis.length === 0) return 0;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const e of editaveis) {
    const resposta = await fetch(e.url);
    if (!resposta.ok) throw new Error(`Falha ao ler ${e.nome}.`);
    zip.file(e.nome, await resposta.blob());
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
  return editaveis.length;
}
