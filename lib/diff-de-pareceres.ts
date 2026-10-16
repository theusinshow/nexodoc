/**
 * O QUE MUDOU ENTRE DUAS AUDITORIAS do mesmo memorial.
 *
 * O delta do memorial (`audit-fingerprint.ts`) responde o que mudou no
 * DOCUMENTO — quais capítulos entraram, saíram ou foram mexidos — e serve para
 * decidir se vale pagar uma releitura. Este arquivo responde a pergunta
 * seguinte, que é a de quem já pagou: dos problemas apontados da última vez,
 * quais sumiram, quais continuam de pé, e quais apareceram agora.
 *
 * POR QUE NÃO CASAR PELO ID
 *
 * O `id` do achado (`INC-001`) é POSICIONAL: sai da ordenação do parecer, e a
 * mesma ocorrência vira `INC-004` no parecer seguinte se três achados mais
 * graves entrarem na frente. Casar por id diria que tudo foi corrigido e tudo é
 * novo, ao mesmo tempo.
 *
 * POR QUE NÃO CASAR PELA PÁGINA
 *
 * Pela razão inversa: corrigir um memorial mexe na paginação. Um parágrafo
 * removido no capítulo 3 desce todo o resto do documento, e o achado da página
 * 40 passa a morar na 39 sem nada ter acontecido com ele. Página é o dado que
 * MAIS se move entre revisões — é por isso que a reancoragem existe em
 * `audit-reuso.ts`, e é por isso que ela não entra na chave daqui.
 *
 * O que sobra, e é o que se usa: o TIPO do defeito e o TRECHO citado. Os dois
 * descrevem o problema em si, e um problema que continua de pé continua sendo
 * citado com as mesmas palavras — se o trecho mudou, o texto mudou, e o achado
 * antigo deixou de existir de verdade.
 *
 * Puro: nada de IO, nada de modelo. Comparar dois pareceres não pode custar uma
 * terceira auditoria.
 */

import type { AuditFinding, AuditReport } from "./audit-report.ts";

export type DiffDePareceres = {
  /** Estavam no parecer anterior e não estão mais: o trecho saiu ou mudou. */
  corrigidos: AuditFinding[];
  /** Continuam apontados: mesmo tipo e trecho, ou o mesmo termo de busca. */
  persistentes: AuditFinding[];
  /** Não estavam no anterior. */
  novos: AuditFinding[];
  /**
   * Só quando o texto da versão anterior foi dado: os NOVOS cujo trecho já
   * estava lá — a leitura anterior não os viu. A soma com `novosEmTextoAlterado`
   * pode ficar abaixo de `novos`: o achado sem trecho reconhecível não vai para
   * lado nenhum, porque atribuí-lo a um dos dois seria chute.
   */
  novosEmTextoQueJaExistia?: AuditFinding[];
  /** Só com o texto anterior: os NOVOS cujo trecho não existia antes. */
  novosEmTextoAlterado?: AuditFinding[];
};

function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A identidade de um achado ENTRE VERSÕES. Tipo + trecho, sem id e sem página.
 *
 * O trecho é cortado em 120 caracteres — o mesmo corte que a deduplicação da
 * auditoria usa — porque a cauda de uma evidência longa costuma trazer a
 * paginação e a numeração de item, que mudam sem que o defeito mude.
 */
export function chaveEntreVersoes(finding: AuditFinding): string {
  return `${normalizar(finding.tipo)}|${normalizar(finding.evidencia).slice(0, 120)}`;
}

/** Esqueleto para comparar trecho com texto: sem acento, caixa, espaço nem pontuação. */
function esqueleto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Abaixo disto, "um termo contém o outro" casa por acaso ("disposicoes"). */
const MIN_TERMO_CONTIDO = 10;

/**
 * O MESMO TERMO DE BUSCA — o segundo caminho para dizer "é o mesmo defeito".
 *
 * Tipo + trecho sozinhos não reconheciam NADA entre corridas: no laço de
 * corrigir e reauditar o 040_26_est_md_a (16/10/2026), quatro voltas deram
 * "0 continuam" com a NBR 7191:1982 e a sondagem apontadas em todas. O modelo
 * reescreve o `tipo` a cada corrida ("Edição normativa a validar" → "Vigência
 * de norma a confirmar") e recita a evidência com outra moldura. O
 * `termo_busca` é a palavra exata que ele manda procurar no documento, e ela
 * não muda.
 *
 * Contido conta, com duas travas medidas no banco de dev (1.105 achados):
 * "mínimo de 60" e "mínimo de 60 minutos" são o mesmo TRRF; "DISPOSICOES"
 * dentro de "8. DISPOSICOES COMPLEMENTARES" não é o mesmo achado — daí o
 * comprimento mínimo e o menor ter ao menos metade do maior. Com elas, os
 * pares que se juntariam DENTRO de um mesmo parecer são todos o mesmo defeito
 * dito duas vezes ("Cidade do Autista" × "Cidade do Autista").
 *
 * Não esconde nada: no pior caso um achado novo é rotulado "continua".
 */
export function mesmoTermoDeBusca(a: AuditFinding, b: AuditFinding): boolean {
  const x = esqueleto(a.termo_busca);
  const y = esqueleto(b.termo_busca);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length < y.length ? [x, y] : [y, x];
  return curto.length >= MIN_TERMO_CONTIDO && longo.includes(curto) && curto.length / longo.length >= 0.5;
}

function mesmoDefeito(a: AuditFinding, b: AuditFinding): boolean {
  return chaveEntreVersoes(a) === chaveEntreVersoes(b) || mesmoTermoDeBusca(a, b);
}

/** O que o achado manda procurar no documento: o termo, senão o trecho entre aspas. */
function agulha(f: AuditFinding): string {
  const termo = esqueleto(f.termo_busca);
  if (termo.length >= MIN_TERMO_CONTIDO) return termo;
  const citado = [...String(f.evidencia ?? "").matchAll(/[“"«]([^”"»]{8,})[”"»]/g)].map((m) => m[1])[0];
  return esqueleto(citado ?? "");
}

/**
 * Compara dois pareceres do mesmo memorial.
 *
 * A ordem dos argumentos é a da leitura: o de ANTES primeiro. Trocá-los inverte
 * "corrigido" e "novo" — e nenhum dos dois é simétrico, então a assinatura é
 * nomeada e não posicional para quem chama não errar em silêncio.
 *
 * `textoAnterior`, quando vem, é o texto da versão anterior do documento, e
 * separa os novos em "já estava lá" e "texto alterado".
 */
export function compararPareceres(args: {
  anterior: AuditReport;
  atual: AuditReport;
  textoAnterior?: string;
}): DiffDePareceres {
  // O primeiro de cada chave vence: duas ocorrências com o mesmo tipo e o
  // mesmo trecho são a mesma coisa dita duas vezes, e contá-las em dobro
  // inflaria "corrigidos" quando uma delas saísse.
  const doAnterior: AuditFinding[] = [];
  const chavesVistas = new Set<string>();
  for (const finding of args.anterior.incongruencias) {
    const chave = chaveEntreVersoes(finding);
    if (chavesVistas.has(chave)) continue;
    chavesVistas.add(chave);
    doAnterior.push(finding);
  }

  const persistentes: AuditFinding[] = [];
  const novos: AuditFinding[] = [];
  const casados = new Set<AuditFinding>();

  for (const finding of args.atual.incongruencias) {
    // Um par por achado antigo: dois novos não "continuam" o mesmo antigo, a
    // não ser que sejam a mesma chave exata (a duplicata de sempre).
    const par =
      doAnterior.find((a) => chaveEntreVersoes(a) === chaveEntreVersoes(finding)) ??
      doAnterior.find((a) => !casados.has(a) && mesmoDefeito(a, finding));
    if (par) {
      casados.add(par);
      persistentes.push(finding);
    } else {
      novos.push(finding);
    }
  }

  const corrigidos = doAnterior.filter((a) => !casados.has(a));

  if (args.textoAnterior === undefined) return { corrigidos, persistentes, novos };

  const texto = esqueleto(args.textoAnterior);
  const novosEmTextoQueJaExistia: AuditFinding[] = [];
  const novosEmTextoAlterado: AuditFinding[] = [];
  for (const finding of novos) {
    const a = agulha(finding);
    if (!a) continue;
    (texto.includes(a) ? novosEmTextoQueJaExistia : novosEmTextoAlterado).push(finding);
  }

  return { corrigidos, persistentes, novos, novosEmTextoQueJaExistia, novosEmTextoAlterado };
}

/**
 * A frase de uma linha que vai para a tela. Fora do componente porque ela é
 * decisão de conteúdo — o que vale a pena dizer e em que ordem —, e porque
 * assim dá para prová-la sem navegador.
 *
 * A ordem não é arbitrária: primeiro o que saiu (é o efeito do trabalho de
 * quem corrigiu), depois o que apareceu (é a notícia ruim, e precisa ser vista),
 * e por último o que ficou. Devolve "" quando não há nada a dizer — parecer
 * idêntico não merece uma faixa na tela.
 */
export function resumoDoDiff(diff: DiffDePareceres): string {
  const partes: string[] = [];
  const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

  if (diff.corrigidos.length > 0) {
    partes.push(`${plural(diff.corrigidos.length, "achado saiu", "achados saíram")}`);
  }
  if (diff.novos.length > 0) {
    partes.push(`${plural(diff.novos.length, "achado novo", "achados novos")}`);
  }
  if (diff.persistentes.length > 0) {
    partes.push(`${plural(diff.persistentes.length, "continua", "continuam")} de pé`);
  }

  return partes.join(" · ");
}
