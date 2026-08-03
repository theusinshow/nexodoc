/**
 * Teste da PROJEÇÃO das folhas: `selos` (o que o PDF diz) + `ajustes` (o que o
 * usuário mudou) → `Folha[]` (o que a montagem lê).
 *
 * A primeira asserção é a que mais importa: sem ajuste nenhum, a projeção tem de
 * devolver exatamente os selos. É o que prova que a fundação entrou sem regredir
 * a montagem já validada à mão.
 *
 *   node scripts/test-nexo-folhas.ts   (== npm run test:nexo:folhas)
 */
import assert from "node:assert/strict";

import {
  aplicarAjuste,
  chaveDeOrdem,
  ehAvulsa,
  folhaId,
  folhas,
  folhasRemovidas,
  gruposDasFolhas,
  type Ajuste,
  type FolhaId,
} from "../modules/nexo/lib/folhas.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
// A divisão automática chega injetada. O teste passa a função REAL de produção —
// um dublê aqui só provaria que o parâmetro é chamado.
import { buildBalancedQuantities, faixasDosTomos } from "../lib/ld/ld-rules.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

function selo(fileName: string, pageNumber: number, extra: Partial<SeloForLd> = {}): SeloForLd {
  return {
    fileName,
    pageNumber,
    disciplina: "ARQUITETURA",
    folha: pageNumber,
    total: 3,
    numeroFolha: String(pageNumber),
    arquivo: `${fileName}-${pageNumber}`,
    conteudo: `Prancha ${pageNumber}`,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
    ...extra,
  };
}

const SELOS: SeloForLd[] = [
  selo("a.pdf", 1),
  selo("a.pdf", 2),
  selo("b.pdf", 1, { disciplina: "ESTRUTURAL" }),
];

// ---------------------------------------------------------------------------
// A garantia de não-regressão
// ---------------------------------------------------------------------------

test("sem ajustes, a projeção devolve os selos na ordem natural", () => {
  const out = folhas(SELOS, {});
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((f) => [f.fileName, f.pageNumber]),
    [
      ["a.pdf", 1],
      ["a.pdf", 2],
      ["b.pdf", 1],
    ],
  );
  // Todo campo do selo continua chegando intacto.
  assert.equal(out[2].disciplina, "ESTRUTURAL");
  assert.equal(out[0].conteudo, "Prancha 1");
  assert.equal(out.every((f) => f.editado === false), true);
});

test("folhaId é o par arquivo#página, estável entre leituras", () => {
  assert.equal(folhaId(SELOS[0]), "a.pdf#1");
  assert.equal(folhaId(SELOS[2]), "b.pdf#1");
  // Sem página (PDF de uma folha só) não pode colidir com a página 1.
  assert.notEqual(folhaId(selo("c.pdf", 1)), folhaId({ ...selo("c.pdf", 1), pageNumber: null }));
});

// ---------------------------------------------------------------------------
// Os quatro campos editáveis
// ---------------------------------------------------------------------------

test("ajuste de título troca só o título e marca `editado`", () => {
  const out = folhas(SELOS, { "a.pdf#1": { titulo: "PLANTA BAIXA REVISADA" } });
  assert.equal(out[0].conteudo, "PLANTA BAIXA REVISADA");
  assert.equal(out[0].editado, true);
  // Nada mais foi tocado.
  assert.equal(out[0].disciplina, "ARQUITETURA");
  assert.equal(out[0].arquivo, "a.pdf-1");
  assert.equal(out[1].editado, false);
});

test("ajuste de disciplina reclassifica a folha", () => {
  const out = folhas(SELOS, { "a.pdf#1": { disciplina: "HIDROSSANITARIO" } });
  assert.equal(out[0].disciplina, "HIDROSSANITARIO");
  assert.equal(out[0].editado, true);
});

test("string vazia é tratada como ausente (não deixa título em branco na LD)", () => {
  const out = folhas(SELOS, { "a.pdf#1": { titulo: "   ", disciplina: "" } });
  assert.equal(out[0].conteudo, "Prancha 1");
  assert.equal(out[0].disciplina, "ARQUITETURA");
  assert.equal(out[0].editado, false);
});

// ---------------------------------------------------------------------------
// Ordem esparsa
// ---------------------------------------------------------------------------

test("ordem manual move a folha sem renumerar as outras", () => {
  const out = folhas(SELOS, { "b.pdf#1": { ordem: 0 } });
  assert.deepEqual(out.map(folhaId), ["b.pdf#1", "a.pdf#1", "a.pdf#2"]);
  assert.equal(out[0].editado, true);
});

test("folhas sem ordem mantêm a ordem natural entre si", () => {
  const out = folhas(SELOS, { "a.pdf#2": { ordem: 99 } });
  assert.deepEqual(out.map(folhaId), ["a.pdf#1", "b.pdf#1", "a.pdf#2"]);
});

// ---------------------------------------------------------------------------
// Grupo: o manual manda
// ---------------------------------------------------------------------------

test("grupo manual vence a divisão automática", () => {
  const ajustes: Record<FolhaId, Ajuste> = {
    "a.pdf#1": { grupo: 2 },
    "a.pdf#2": { grupo: 1 },
    "b.pdf#1": { grupo: 2 },
  };
  assert.deepEqual(gruposDasFolhas(folhas(SELOS, ajustes), 2, buildBalancedQuantities), [
    ["a.pdf#2"],
    ["a.pdf#1", "b.pdf#1"],
  ]);
});

test("sem nenhum grupo manual, cai na divisão automática por quantidade", () => {
  assert.deepEqual(gruposDasFolhas(folhas(SELOS, {}), 2, buildBalancedQuantities), [
    ["a.pdf#1", "a.pdf#2"],
    ["b.pdf#1"],
  ]);
});

test("grupo em algumas folhas só: as sem grupo caem na divisão automática", () => {
  const out = folhas(SELOS, { "b.pdf#1": { grupo: 1 } });
  const grupos = gruposDasFolhas(out, 2, buildBalancedQuantities);
  // A folha com grupo manual está no tomo que ela mandou...
  assert.equal(grupos[0].includes("b.pdf#1"), true);
  // ...e nenhuma folha se perde.
  assert.equal(grupos.flat().length, 3);
  assert.equal(new Set(grupos.flat()).size, 3);
});

// ---------------------------------------------------------------------------
// Robustez
// ---------------------------------------------------------------------------

test("ajuste órfão (prancha removida) é ignorado, não quebra", () => {
  const out = folhas(SELOS, { "sumiu.pdf#7": { titulo: "fantasma" } });
  assert.equal(out.length, 3);
  assert.equal(out.every((f) => f.editado === false), true);
});

test("reanexar pranchas preserva os ajustes das folhas que continuam existindo", () => {
  const ajustes = { "a.pdf#1": { titulo: "MANTIDO" } };
  const relidos = [...SELOS, selo("c.pdf", 1)];
  const out = folhas(relidos, ajustes);
  assert.equal(out.length, 4);
  assert.equal(out[0].conteudo, "MANTIDO");
});

test("aplicarAjuste acumula campos em vez de substituir o ajuste inteiro", () => {
  const depois = aplicarAjuste({ "a.pdf#1": { titulo: "T" } }, "a.pdf#1", { grupo: 2 });
  assert.deepEqual(depois["a.pdf#1"], { titulo: "T", grupo: 2 });
});

test("aplicarAjuste não muta o objeto recebido", () => {
  const antes: Record<FolhaId, Ajuste> = { "a.pdf#1": { titulo: "T" } };
  aplicarAjuste(antes, "a.pdf#1", { titulo: "OUTRO" });
  assert.equal(antes["a.pdf#1"].titulo, "T");
});

test("aplicarAjuste com campo vazio LIMPA o campo (desfazer a edição)", () => {
  const depois = aplicarAjuste({ "a.pdf#1": { titulo: "T", grupo: 2 } }, "a.pdf#1", {
    titulo: undefined,
  });
  assert.equal("titulo" in depois["a.pdf#1"], false);
  assert.equal(depois["a.pdf#1"].grupo, 2);
});

// ---------------------------------------------------------------------------
// A troca da divisão no canvas só é segura porque estas duas concordam
// ---------------------------------------------------------------------------

test("sem grupo manual, gruposDasFolhas divide igual a faixasDosTomos", () => {
  const muitos = Array.from({ length: 24 }, (_, i) => selo("a.pdf", i + 1));
  const projetadas = folhas(muitos, {});
  const grupos = gruposDasFolhas(projetadas, 3, buildBalancedQuantities);
  const faixas = faixasDosTomos(24, 3);

  assert.equal(grupos.length, 3);
  grupos.forEach((ids, i) => {
    const esperado = projetadas.slice(faixas[i].inicio - 1, faixas[i].fim).map((f) => f.id);
    assert.deepEqual(ids, esperado, `tomo ${i + 1} divergiu da faixa`);
  });
});

test("desfazer: titulo undefined devolve o que o selo dizia e limpa `editado`", () => {
  const id = folhaId(SELOS[0]);
  const comAjuste = aplicarAjuste({}, id, { titulo: "TROCADO" });
  assert.equal(folhas(SELOS, comAjuste)[0].conteudo, "TROCADO");
  assert.equal(folhas(SELOS, comAjuste)[0].editado, true);

  const desfeito = aplicarAjuste(comAjuste, id, { titulo: undefined });
  // Ajuste vazio não pode sobrar ocupando o estado.
  assert.deepEqual(desfeito, {});
  assert.equal(folhas(SELOS, desfeito)[0].conteudo, SELOS[0].conteudo);
  assert.equal(folhas(SELOS, desfeito)[0].editado, false);
});

test("título só de espaços é tratado como ausente — não vira título em branco na LD", () => {
  const id = folhaId(SELOS[0]);
  const ajustes = aplicarAjuste({}, id, { titulo: "   " });
  const out = folhas(SELOS, ajustes);
  assert.equal(out[0].conteudo, SELOS[0].conteudo);
  assert.equal(out[0].editado, false);
});

// ---------------------------------------------------------------------------
// A chave de ordenação, que o arrasto (4A) precisa enxergar
// ---------------------------------------------------------------------------

test("a folha carrega a posição natural da leitura", () => {
  const out = folhas(SELOS, {});
  assert.deepEqual(out.map((f) => f.natural), [0, 1, 2]);
});

test("chaveDeOrdem é `ordem` quando há, e a natural quando não há", () => {
  const ajustes = aplicarAjuste({}, folhaId(SELOS[2]), { ordem: 0.5 });
  const out = folhas(SELOS, ajustes);
  // A reordenada vem em 2º e a chave dela é a `ordem` manual.
  assert.deepEqual(out.map((f) => chaveDeOrdem(f)), [0, 0.5, 1]);
  // A natural NÃO muda com a reordenação: é a posição na leitura.
  assert.deepEqual(out.map((f) => f.natural), [0, 2, 1]);
});

test("editadoTexto separa texto reescrito de folha só remanejada", () => {
  // Por id, não por índice: `ordem: 3.5` reordena a.pdf#1 para o FIM da projeção
  // (as outras duas folhas de SELOS têm natural 1 e 2, ambos < 3.5) — indexar
  // [0] pegaria a folha errada e derrubaria a asserção seguinte por um motivo
  // que nada tem a ver com o que este teste quer provar.
  const so_arranjo = folhas(SELOS, { "a.pdf#1": { grupo: 2, ordem: 3.5 } });
  const arranjada = so_arranjo.find((f) => f.id === "a.pdf#1")!;
  assert.equal(arranjada.editado, true);
  assert.equal(arranjada.editadoTexto, false);

  const com_texto = folhas(SELOS, { "a.pdf#1": { titulo: "OUTRO" } });
  assert.equal(com_texto.find((f) => f.id === "a.pdf#1")!.editadoTexto, true);

  const disciplina = folhas(SELOS, { "a.pdf#1": { disciplina: "ESTRUTURAL" } });
  assert.equal(disciplina.find((f) => f.id === "a.pdf#1")!.editadoTexto, true);
});

// ---------------------------------------------------------------------------
// Remover: a folha sai de tudo, e volta inteira
// ---------------------------------------------------------------------------

test("folha removida some da projeção — e some de TODOS os documentos", () => {
  const out = folhas(SELOS, { "a.pdf#2": { removida: true } });
  assert.deepEqual(out.map((f) => f.id), ["a.pdf#1", "b.pdf#1"]);
  // A projeção é o ponto único que LD, volume e conferência leem: sair daqui é
  // sair dos três. Se este teste passar a listar a removida, os três regridem.
  assert.equal(out.some((f) => f.id === "a.pdf#2"), false);
});

test("a folha removida continua listada para poder voltar", () => {
  const removidas = folhasRemovidas(SELOS, { "a.pdf#2": { removida: true } });
  assert.equal(removidas.length, 1);
  assert.equal(removidas[0].id, "a.pdf#2");
  // O rótulo tem de reconhecer a folha sem ela estar na tela.
  assert.equal(removidas[0].rotulo, "a.pdf-2");
});

test("restaurar devolve a folha COM as correções que ela já tinha", () => {
  let ajustes = aplicarAjuste({}, "a.pdf#2", { titulo: "PLANTA CORRIGIDA" });
  ajustes = aplicarAjuste(ajustes, "a.pdf#2", { removida: true });
  assert.equal(folhas(SELOS, ajustes).length, 2);

  const restaurado = aplicarAjuste(ajustes, "a.pdf#2", { removida: undefined });
  const out = folhas(SELOS, restaurado);
  assert.equal(out.length, 3);
  // O título corrigido sobreviveu à ida e à volta — remover não é apagar.
  assert.equal(out.find((f) => f.id === "a.pdf#2")!.conteudo, "PLANTA CORRIGIDA");
});

test("a divisão em tomos não conta a folha removida", () => {
  const out = folhas(SELOS, { "a.pdf#2": { removida: true } });
  const grupos = gruposDasFolhas(out, 2, buildBalancedQuantities);
  assert.equal(grupos.flat().length, 2);
  assert.equal(grupos.flat().includes("a.pdf#2"), false);
});

// ---------------------------------------------------------------------------
// Adicionar: a prancha que não foi lida
// ---------------------------------------------------------------------------

test("folha avulsa entra na projeção, no fim da leitura", () => {
  const out = folhas(SELOS, {}, ["manual#x"]);
  assert.equal(out.length, 4);
  assert.equal(out[3].id, "manual#x");
  assert.equal(out[3].avulsa, true);
  // Sem PDF por trás: é isso que a tela mostra, e o que mantém a folha fora do
  // recorte de páginas do volume.
  assert.equal(out[3].fileName, "");
  assert.equal(out[3].pageNumber, null);
  // E nenhuma folha lida vira avulsa por tabela.
  assert.equal(out.slice(0, 3).every((f) => f.avulsa === false), true);
});

test("a folha avulsa é editada pelo MESMO mecanismo das outras", () => {
  const out = folhas(
    SELOS,
    { "manual#x": { titulo: "PRANCHA QUE NAO VEIO", arquivo: "040_26_arq_009_a", numero: 9 } },
    ["manual#x"],
  );
  const nova = out.find((f) => f.id === "manual#x")!;
  assert.equal(nova.conteudo, "PRANCHA QUE NAO VEIO");
  assert.equal(nova.arquivo, "040_26_arq_009_a");
  // O número vai no canal que vence o parser, igual ao de uma folha lida.
  assert.equal(nova.folhaManual, 9);
});

test("folha avulsa pode ser arrastada para um tomo como qualquer outra", () => {
  const out = folhas(SELOS, { "manual#x": { grupo: 2 } }, ["manual#x"]);
  const grupos = gruposDasFolhas(out, 2, buildBalancedQuantities);
  assert.equal(grupos[1].includes("manual#x"), true);
});

test("avulsa removida não aparece na lista de restauração (não há selo por trás)", () => {
  // A remoção dela é exclusão de verdade, feita fora da projeção — aqui só se
  // garante que ela não vira um fantasma restaurável.
  const removidas = folhasRemovidas(SELOS, { "manual#x": { removida: true } });
  assert.equal(removidas.length, 0);
});

test("ehAvulsa distingue o id criado à mão do par arquivo#página", () => {
  assert.equal(ehAvulsa("manual#abc"), true);
  assert.equal(ehAvulsa("a.pdf#1"), false);
});

console.log(`\n${passed} teste(s) OK`);
