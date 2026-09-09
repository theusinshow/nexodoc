/**
 * AS PREFERÊNCIAS DA HOME e as ordens da lista. Puro → node cru.
 *
 *   node scripts/test-home-preferencias.ts   (== npm run test:home-preferencias)
 *
 * Duas coisas que só se provam sem navegador:
 *
 *  1. A NORMALIZAÇÃO. Ela é a fronteira entre o `localStorage` — que qualquer
 *     pessoa edita no DevTools, e que guarda o formato de versões antigas — e a
 *     Home. Se ela deixar passar um widget que não existe, a tela monta
 *     `<undefined />` e a página inteira cai por causa de uma preferência;
 *  2. AS QUATRO ORDENS. Ordem errada não quebra nada e não aparece em teste de
 *     DOM: a lista continua desenhando oito cartões, só que na ordem errada.
 *     É o tipo de defeito que só um assert pega.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contadoresDaAtencao,
  ehOrdem,
  iniciaisDe,
  ordenarLista,
  ORDENS,
  type ProjetoParaOrdenarPorNome,
} from "../lib/atencao-do-painel.ts";
import {
  CATALOGO,
  IDS_DO_CATALOGO,
  normalizar,
  PADRAO,
  PROJETOS_VISIVEIS,
} from "../lib/preferencias-da-home.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

const p = (
  over: Partial<ProjetoParaOrdenarPorNome> & { projectId: string },
): ProjetoParaOrdenarPorNome => ({
  diasParado: 0,
  recebidos: 0,
  enviados: 0,
  atualizadoEmMs: 0,
  codigo: over.projectId.toUpperCase(),
  nome: "",
  ...over,
});

console.log("preferências da home\n");

/* ── o catálogo ─────────────────────────────────────────────────────────── */

test("o catálogo não tem id repetido", () => {
  assert.equal(new Set(IDS_DO_CATALOGO).size, IDS_DO_CATALOGO.length);
});

test("todo widget do padrão existe no catálogo", () => {
  // O padrão é o que TODA pessoa vê na estreia. Um id morto aqui derruba a
  // Home de quem nunca personalizou nada — que é todo mundo, no primeiro dia.
  for (const id of PADRAO.widgets) assert.ok(IDS_DO_CATALOGO.includes(id), id);
});

test("catálogo e registro têm os MESMOS ids", () => {
  /*
   * As duas listas vivem em arquivos separados por uma fronteira real: o
   * catálogo é dado puro (roda aqui, em node), e o registro importa React. Um
   * id no catálogo sem componente no registro monta `<undefined />` e derruba a
   * Home inteira por causa de um widget opcional.
   *
   * O registro é LIDO COMO TEXTO porque não dá para importar JSX daqui. É
   * grosseiro e é o que pega o defeito de verdade — a alternativa era não
   * provar nada.
   */
  const fonte = readFileSync(
    new URL("../components/home/widgets/registro.tsx", import.meta.url),
    "utf8",
  );
  const mapa = fonte.slice(fonte.indexOf("const COMPONENTES"), fonte.indexOf("};", fonte.indexOf("const COMPONENTES")));
  const noRegistro = [...mapa.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);

  assert.deepEqual(noRegistro.slice().sort(), [...IDS_DO_CATALOGO].sort());
});

test("todo widget do catálogo tem nome, descrição e fonte", () => {
  for (const w of CATALOGO) {
    assert.ok(w.nome.trim(), w.id);
    assert.ok(w.descricao.trim(), w.id);
    assert.ok(["servidor", "navegador", "nenhuma"].includes(w.fonte), w.id);
  }
});

/* ── a normalização ─────────────────────────────────────────────────────── */

test("lixo vira o padrão, e não uma exceção", () => {
  // A Home tem que abrir com a preferência corrompida. Cair no padrão é a
  // única saída que não faz uma escolha de layout derrubar a tela.
  for (const lixo of [null, undefined, 0, "", "abc", [], true]) {
    assert.deepEqual(normalizar(lixo), PADRAO);
  }
});

test("widget que não existe mais é descartado", () => {
  const r = normalizar({ widgets: ["foco", "clima", "meu-dia", "rascunho"] });
  assert.deepEqual(r.widgets, ["foco", "rascunho"]);
});

test("id repetido é descartado — duas chaves iguais quebram o React", () => {
  const r = normalizar({ widgets: ["foco", "foco", "rascunho"] });
  assert.deepEqual(r.widgets, ["foco", "rascunho"]);
});

test("a ORDEM gravada é respeitada — ela é a preferência", () => {
  const r = normalizar({ widgets: ["atividade", "foco", "rascunho"] });
  assert.deepEqual(r.widgets, ["atividade", "foco", "rascunho"]);
});

test("lista VAZIA é escolha legítima, e não ausência", () => {
  /*
   * Quem desligou os três widgets quer a Home sem "Seu espaço". Cair no padrão
   * aqui os traria de volta a cada F5, e a pessoa não teria como desligá-los —
   * o bug mais frustrante que um painel de preferências pode ter.
   */
  assert.deepEqual(normalizar({ widgets: [] }).widgets, []);
});

test("widgets ausente (não vazio) cai no padrão", () => {
  assert.deepEqual(normalizar({ mostrarAtencao: false }).widgets, PADRAO.widgets);
});

test("projetosVisiveis fora da escala cai no padrão", () => {
  for (const v of [0, 1, 7, 999, -3, "oito", null]) {
    assert.equal(normalizar({ projetosVisiveis: v }).projetosVisiveis, PADRAO.projetosVisiveis);
  }
  for (const v of PROJETOS_VISIVEIS) {
    assert.equal(normalizar({ projetosVisiveis: v }).projetosVisiveis, v);
  }
});

test("escopo só aceita 'todos'; qualquer outra coisa é 'meus'", () => {
  // Erra para o lado de mostrar MENOS. Filtro que erra para o lado de mostrar
  // mais é vazamento.
  assert.equal(normalizar({ escopo: "todos" }).escopo, "todos");
  for (const v of ["meus", "TODOS", "", null, 1, {}]) {
    assert.equal(normalizar({ escopo: v }).escopo, "meus");
  }
});

test("a versão é sempre reescrita para a atual", () => {
  assert.equal(normalizar({ versao: 0 }).versao, PADRAO.versao);
  assert.equal(normalizar({ versao: 99 }).versao, PADRAO.versao);
});

/* ── as ordens ──────────────────────────────────────────────────────────── */

test("ehOrdem reconhece as quatro e recusa o resto", () => {
  for (const o of ORDENS) assert.ok(ehOrdem(o.id));
  for (const o of ["criticos", "", null, 1]) assert.equal(ehOrdem(o), false);
});

test("'parados' é a ordem da atenção — o que é SEU vem primeiro", () => {
  const r = ordenarLista(
    [
      p({ projectId: "a", enviados: 9, atualizadoEmMs: 100 }),
      p({ projectId: "b", recebidos: 1, diasParado: 3 }),
      p({ projectId: "c", recebidos: 1, diasParado: 20 }),
    ],
    "parados",
  );
  assert.deepEqual(r.map((x) => x.projectId), ["c", "b", "a"]);
});

test("'recentes' ignora achado — quem pediu recência pediu recência", () => {
  const r = ordenarLista(
    [
      p({ projectId: "a", recebidos: 5, diasParado: 40, atualizadoEmMs: 10 }),
      p({ projectId: "b", atualizadoEmMs: 900 }),
    ],
    "recentes",
  );
  assert.deepEqual(r.map((x) => x.projectId), ["b", "a"]);
});

test("'achados' conta o TOTAL, e não só o que é seu", () => {
  /*
   * A pergunta desta ordem é "onde está a pilha de trabalho", e a pilha inclui
   * o que está com os outros: quem cobra precisa achar o projeto de nove
   * achados mesmo que oito estejam com o Victor.
   */
  const r = ordenarLista(
    [
      p({ projectId: "a", recebidos: 2, enviados: 0 }),
      p({ projectId: "b", recebidos: 1, enviados: 8 }),
    ],
    "achados",
  );
  assert.deepEqual(r.map((x) => x.projectId), ["b", "a"]);
});

test("'alfabetica' usa o NOME e respeita acento", () => {
  // Pelo código daria a ordem do número de contrato — cronológica disfarçada
  // de alfabética. E sem `localeCompare` pt-BR, "Ampliação" cai depois de
  // "Zona" no runtime que ordena por code point.
  const r = ordenarLista(
    [
      p({ projectId: "a", codigo: "SIM999", nome: "Zona industrial" }),
      p({ projectId: "b", codigo: "SIM001", nome: "Ampliação da escola" }),
      p({ projectId: "c", codigo: "SIM500", nome: "Éden do vale" }),
    ],
    "alfabetica",
  );
  assert.deepEqual(r.map((x) => x.projectId), ["b", "c", "a"]);
});

test("sem nome, a A–Z cai no código em vez de sumir", () => {
  const r = ordenarLista(
    [
      p({ projectId: "a", codigo: "SIM900", nome: "" }),
      p({ projectId: "b", codigo: "SIM100", nome: "" }),
    ],
    "alfabetica",
  );
  assert.deepEqual(r.map((x) => x.projectId), ["b", "a"]);
});

test("ordenar não muta a lista de entrada — o chamador é React", () => {
  const entrada = [p({ projectId: "a", atualizadoEmMs: 1 }), p({ projectId: "b", atualizadoEmMs: 9 })];
  const antes = entrada.map((x) => x.projectId);
  ordenarLista(entrada, "recentes");
  assert.deepEqual(entrada.map((x) => x.projectId), antes);
});

/* ── os contadores ──────────────────────────────────────────────────────── */

test("contador zerado SOME, e não vira '0 achados'", () => {
  // Uma faixa que anuncia zeros ensina a não olhar para ela no dia em que
  // tiver um número.
  const r = contadoresDaAtencao([{ recebidos: 0, enviados: 0, diasParado: 0 }]);
  assert.deepEqual(r, []);
});

test("conta ACHADOS em 'com você' e PROJETOS em 'parados'", () => {
  /*
   * As unidades são diferentes de propósito: `diasParado` é o pior item do
   * projeto, e daqui não dá para saber quantos itens dele passaram do limiar.
   * O rótulo diz "projeto" para não mentir sobre o que está contando.
   */
  const r = contadoresDaAtencao([
    { recebidos: 3, enviados: 0, diasParado: 9 },
    { recebidos: 2, enviados: 0, diasParado: 1 },
  ]);
  assert.equal(r.find((c) => c.foco === "com-voce")?.quantos, 5);
  assert.equal(r.find((c) => c.foco === "parados")?.quantos, 1);
});

test("'parados' é subconjunto de 'com você', e a repetição é intencional", () => {
  const r = contadoresDaAtencao([{ recebidos: 4, enviados: 0, diasParado: 30 }]);
  assert.ok(r.find((c) => c.foco === "com-voce"));
  assert.ok(r.find((c) => c.foco === "parados"));
});

test("achado ENVIADO nunca conta como parado — é cobrança, não esquecimento", () => {
  const r = contadoresDaAtencao([{ recebidos: 0, enviados: 5, diasParado: 0 }]);
  assert.equal(r.find((c) => c.foco === "parados"), undefined);
  assert.equal(r.find((c) => c.foco === "com-outros")?.quantos, 5);
});

test("singular e plural nos rótulos", () => {
  const um = contadoresDaAtencao([{ recebidos: 1, enviados: 0, diasParado: 0 }]);
  assert.equal(um[0].rotulo, "1 achado com você");
  const dois = contadoresDaAtencao([{ recebidos: 2, enviados: 0, diasParado: 0 }]);
  assert.equal(dois[0].rotulo, "2 achados com você");
});

/* ── as iniciais ────────────────────────────────────────────────────────── */

test("iniciais: uma letra para um nome, duas para dois", () => {
  assert.equal(iniciaisDe("Carla"), "C");
  assert.equal(iniciaisDe("Carla Mendes"), "CM");
  // O sobrenome do FIM, e não o segundo: "Ana de Souza" é AS, não AD.
  assert.equal(iniciaisDe("Ana de Souza"), "AS");
});

test("iniciais: e-mail perde o domínio, e o ponto separa como espaço", () => {
  assert.equal(iniciaisDe("victor.almeida@prosul.com"), "VA");
  assert.equal(iniciaisDe("carla@prosul.com"), "C");
  assert.equal(iniciaisDe("joao_pedro@prosul.com"), "JP");
});

test("iniciais: string vazia vira '?' e não quebra", () => {
  // A alternativa era `partes[0][0]` num array vazio, que lança e derruba a
  // linha inteira do cartão por causa de um nome que ninguém preencheu.
  assert.equal(iniciaisDe(""), "?");
  assert.equal(iniciaisDe("   "), "?");
});

console.log(`\n${passed} passaram`);
