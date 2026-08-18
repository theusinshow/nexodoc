/**
 * A IMPRESSÃO DIGITAL DE UM ACHADO — o que faz dois relatos serem o mesmo defeito.
 *
 * A chave anterior era `arquivo|tipo|pagina|evidencia[0:120]|conflito[0:120]`, e
 * ela media 7% de estabilidade entre duas corridas Deep do MESMO documento
 * (117_25, 18/08/2026). O motivo: `tipo` e `conflito` são redação livre, e o
 * modelo os reescreve a cada corrida mantendo o defeito —
 *
 *   "Empreendimento estranho"            -> "Identificação de terceiro empreendimento"
 *   "Unidade de seção de condutor errada" -> "Unidade de seção incorreta"
 *   "Município e proprietário divergentes" -> "Órgão proprietário divergente"
 *
 * — mesma página, mesma transcrição, palavras outras. Como rede contra o mesmo
 * achado sair duas vezes na reauditoria, uma chave de 7% está desligada.
 *
 * O QUE NÃO MUDA entre corridas é o que veio do documento: a página e o trecho
 * transcrito. A chave passa a ser feita só disso.
 *
 * MEDIDO, e as duas colunas importam:
 *
 *   chave                              estabilidade   funde achados distintos?
 *   arquivo|tipo|evid|conflito (antes)         7%      não
 *   páginas|citação(30)                       48%      não
 *   páginas|citação(20)|números               47%      não   <- escolhida
 *   páginas|números                           59%      SIM (2)
 *   só página                                 91%      SIM (21)
 *
 * As duas últimas são tentadoras e erradas: fundem "TBS externa 32°C×38°C" com
 * "TBS interna 24°C×23°C", que são defeitos diferentes na mesma página. Chave
 * frouxa não é dedupe, é a próxima coisa a esconder achado — e este produto já
 * pagou por isso.
 *
 * Por que 20 caracteres de citação MAIS os números, e não 30 caracteres secos:
 * os dois medem quase igual aqui, mas o 30 só funciona porque os dois relatos do
 * TBS divergem no caractere 26. Quem separa de verdade é o NÚMERO, e apoiar a
 * chave nele generaliza para documento em que o prefixo comum seja mais longo.
 *
 * PURA: recebe um achado, devolve uma string.
 */
import type { AuditFinding } from "./audit-report.ts";

function esqueleto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * As páginas declaradas, ordenadas — não a string como veio.
 *
 * "17 e 21", "17, 21" e "21 e 17" são a mesma declaração escrita de três jeitos,
 * e o modelo alterna entre eles.
 */
function paginasCanonicas(pagina: unknown): string {
  const nums = String(pagina ?? "").match(/\d+/g) ?? [];
  return [...new Set(nums)].map(Number).sort((a, b) => a - b).join(",");
}

/**
 * O que está entre aspas na evidência.
 *
 * A moldura (`Pág. 17:`, `Fichas dos ambientes:`) é redação do auditor e varia;
 * o miolo é transcrição do documento e não varia. Pôr a moldura na chave é pôr
 * a variação dentro do que deveria ser o invariante.
 */
function trechoCitado(evidencia: unknown): string {
  const bruto = String(evidencia ?? "");
  const aspas = [...bruto.matchAll(/[“"']([^”"']{8,})[”"']/g)].map((m) => m[1]);
  if (aspas.length > 0) return aspas.join(" ");
  return bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e-]+:?\s*/i, "");
}

/**
 * Os números do TRECHO CITADO, canônicos e ordenados.
 *
 * São eles que distinguem dois achados que compartilham um prefixo longo — o
 * caso real: "Temperatura de bulbo seco (TBS): 32,0°C" e "…: 24°C" só divergem
 * no caractere 26.
 *
 * Do trecho, e não da evidência crua: o rótulo `p. 41:` carrega o número da
 * página, e ele entrava na chave. Duas escritas da MESMA transcrição — uma com
 * rótulo, outra sem — davam impressões diferentes, que é exatamente o defeito
 * que esta função existe para não ter.
 */
function numerosDoTrecho(trecho: string): string {
  const out = new Set<string>();
  for (const m of trecho.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d+/g)) {
    out.add(m[0].replace(/\./g, "").replace(",", "."));
  }
  return [...out].sort().join("~");
}

/** Quantos caracteres da transcrição entram na chave. Ver o cabeçalho. */
const CHARS_DA_CITACAO = 20;

/**
 * Dois achados com a mesma impressão descrevem o mesmo defeito.
 *
 * Só entra o que veio do DOCUMENTO — arquivo, páginas, trecho transcrito e os
 * números dele. Nada de `tipo`, `conflito`, `descricao` ou `sugestao_correcao`:
 * são a leitura do modelo sobre o defeito, e é justamente ela que muda.
 */
export function impressaoDoAchado(f: AuditFinding): string {
  const trecho = trechoCitado(f.evidencia);
  return [
    esqueleto(f.arquivo),
    paginasCanonicas(f.pagina),
    esqueleto(trecho).slice(0, CHARS_DA_CITACAO),
    numerosDoTrecho(trecho),
  ].join("|");
}
