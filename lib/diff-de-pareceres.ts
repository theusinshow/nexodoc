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
  /**
   * Só quando o texto ATUAL foi dado: dos que saíram, os cujo trecho continua
   * igual no documento. Não foram corrigidos — a leitura desta vez não os
   * apontou. Chamá-los de "corrigidos" é o engano da volta 5 do laço do 040_26
   * (16/10/2026): "8 corrigidos" quando 2 tinham sido mexidos, e a NBR
   * 7191:1982 seguia no texto. Os demais saíram com o trecho mudado.
   */
  saidosComTrechoIgual?: AuditFinding[];
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
 * A proporção perdia o caso de quem cita mais contexto da segunda vez — "mínimo
 * de 60" × "resistência ao fogo com o mínimo de 60", "Cap.1 – Pág.6" × "…odt
 * Cap.1 – Pág.6" (volta 5 do laço, IA real). Para esses vale o termo contido
 * sem proporção, desde que na MESMA página. Custo medido: um par distinto em
 * 1.105 achados ("DISPOSICOES" × "8. DISPOSICOES COMPLEMENTARES", p. 4).
 *
 * Não esconde nada: no pior caso um achado novo é rotulado "continua".
 */
export function mesmoTermoDeBusca(a: AuditFinding, b: AuditFinding): boolean {
  const x = esqueleto(a.termo_busca);
  const y = esqueleto(b.termo_busca);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length < y.length ? [x, y] : [y, x];
  if (!longo.includes(curto)) return false;
  if (curto.length >= MIN_TERMO_CONTIDO && curto.length / longo.length >= 0.5) return true;
  return curto.length >= MIN_TERMO_NA_MESMA_PAGINA && mesmaPagina(a, b);
}

/** O termo contido sem proporção só casa na mesma página — e não abaixo disto. */
const MIN_TERMO_NA_MESMA_PAGINA = 8;

function mesmaPagina(a: AuditFinding, b: AuditFinding): boolean {
  const de = (p: unknown) => new Set(String(p ?? "").match(/\d+/g) ?? []);
  const pa = de(a.pagina);
  return [...de(b.pagina)].some((p) => pa.has(p));
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

function soEspaco(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

/**
 * O trecho citado, LITERAL: com acento, caixa e pontuação — só o espaço é
 * normalizado. É o que decide se um achado que saiu foi mexido.
 *
 * O esqueleto de `agulha` não serve para isto: corrigir uma crase ("a
 * compressão" → "à compressão") ou uma concordância ("pilares apresentado" →
 * "apresentados") deixa o esqueleto do termo intacto, e a correção passaria por
 * "trecho igual". Pedaço curto demais não decide nada e fica de fora.
 */
function trechosLiterais(f: AuditFinding): string[] {
  const bruto = String(f.evidencia ?? "");
  // Aspas curtas são citação DENTRO da frase (o “α” do 040_26), não o trecho.
  const entreAspas = [...bruto.matchAll(/[“"«]([^”"»]{12,})[”"»]/g)].map((m) => m[1]);
  const pedacos =
    entreAspas.length > 0
      ? entreAspas
      : [bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e–-]+:?\s*/i, "").replace(/[“”«»"]/g, "")];
  /*
   * LINHA A LINHA. A evidência sem aspas costuma costurar trechos que não são
   * vizinhos — no laço do 040_26 ela juntou duas frases da p. 6 pulando a do
   * meio —, e o bloco inteiro nunca é literal. Cada linha, sim.
   */
  return pedacos
    .flatMap((p) => p.split(/\n+/))
    .map(soEspaco)
    .filter((p) => p.length >= 12);
}

/**
 * Compara dois pareceres do mesmo memorial.
 *
 * A ordem dos argumentos é a da leitura: o de ANTES primeiro. Trocá-los inverte
 * "corrigido" e "novo" — e nenhum dos dois é simétrico, então a assinatura é
 * nomeada e não posicional para quem chama não errar em silêncio.
 *
 * `textoAnterior`, quando vem, é o texto da versão anterior do documento, e
 * separa os novos em "já estava lá" e "texto alterado". `textoAtual` separa,
 * dos que saíram, os que continuam no texto sem que ninguém os tenha mexido.
 */
export function compararPareceres(args: {
  anterior: AuditReport;
  atual: AuditReport;
  textoAnterior?: string;
  textoAtual?: string;
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
  const saidos =
    args.textoAtual === undefined
      ? {}
      : (() => {
          // Sem aspas dos dois lados: a evidência sem citação também as perdeu.
          const atual = soEspaco((args.textoAtual ?? "").replace(/[“”«»"]/g, ""));
          return {
            saidosComTrechoIgual: corrigidos.filter((f) => {
              const pedacos = trechosLiterais(f);
              return pedacos.length > 0 && pedacos.every((p) => atual.includes(p));
            }),
          };
        })();

  if (args.textoAnterior === undefined) return { corrigidos, persistentes, novos, ...saidos };

  const texto = esqueleto(args.textoAnterior);
  const novosEmTextoQueJaExistia: AuditFinding[] = [];
  const novosEmTextoAlterado: AuditFinding[] = [];
  for (const finding of novos) {
    const a = agulha(finding);
    if (!a) continue;
    (texto.includes(a) ? novosEmTextoQueJaExistia : novosEmTextoAlterado).push(finding);
  }

  return { corrigidos, persistentes, novos, novosEmTextoQueJaExistia, novosEmTextoAlterado, ...saidos };
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
