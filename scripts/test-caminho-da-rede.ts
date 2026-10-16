/**
 * Teste do CAMINHO DA REDE no rodapé da LD — dedução, sugestão e colagem.
 *
 * Os casos vêm das 62 LDs de `docs/samples` (08/10/2026): o caminho é o do
 * próprio `.odt`, e só a pasta da emissão é livre.
 *
 *   node scripts/test-caminho-da-rede.ts   (== npm run test:caminho-da-rede)
 */
import assert from "node:assert/strict";

import {
  aplicarColado,
  baseDeduzida,
  caminhoDaLd,
  confirmarRede,
  gravarRede,
  lerRede,
  nomeDaLd,
  redeDoVolumeAnterior,
  redePendente,
  separarCaminhoColado,
  sugerirEmissao,
} from "../lib/ld/caminho-da-rede.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FALHOU  ${name}`);
    throw err;
  }
}

test("sugestão da primeira emissão, mês por nome", () => {
  assert.equal(sugerirEmissao("a", "OUTUBRO", "2025"), "1_emissão inicial_out-25");
});

test("sugestão da revisão b, mês por número", () => {
  assert.equal(sugerirEmissao("b", "4", "2026"), "2_revisão_abr-26");
});

test("sem mês nem ano a sugestão fica só com o número", () => {
  assert.equal(sugerirEmissao("a"), "1_emissão inicial");
});

test("nome da LD como o escritório salva", () => {
  assert.equal(nomeDaLd("116-25", "ELT", "A"), "116_25_elt_ld_a.odt");
});

test("dedução: Criciúma, elétrico", () => {
  assert.equal(
    baseDeduzida({ cliente: "pmcriciuma", codigo: "116-25", disciplina: "elt" }),
    "P:\\cad\\pmcriciuma\\116_25\\eletrico\\documentos",
  );
});

test("dedução: urbanismo cai na pasta do arquitetônico", () => {
  assert.equal(
    baseDeduzida({ cliente: "prefchap", codigo: "040_26", disciplina: "urb" }),
    "P:\\cad\\prefchap\\040_26\\arquitetonico\\documentos",
  );
});

test("dedução: sigla fora da tabela para no projeto, sem inventar pasta", () => {
  assert.equal(baseDeduzida({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "xyz" }), "P:\\cad\\pmcriciuma\\116_25");
});

test("dedução: sem cliente não há caminho", () => {
  assert.equal(baseDeduzida({ codigo: "116_25", disciplina: "elt" }), "");
});

test("colado com aspas e nome de arquivo no fim", () => {
  const c = separarCaminhoColado('"P:\\cad\\pmcriciuma\\116_25\\cabeamento\\documentos\\1_emissão inicial_out-2025\\116_25_cab_ld_a.odt"');
  assert.deepEqual(c, {
    base: "P:\\cad\\pmcriciuma\\116_25\\cabeamento\\documentos",
    emissao: "1_emissão inicial_out-2025",
    cliente: "pmcriciuma",
    pasta: "cabeamento",
  });
});

test("colado com barras normais e barra no fim", () => {
  const c = separarCaminhoColado("P:/cad/pmnavegantes/113_22/eletrico/documentos/");
  assert.deepEqual(c, {
    base: "P:\\cad\\pmnavegantes\\113_22\\eletrico\\documentos",
    emissao: "",
    cliente: "pmnavegantes",
    pasta: "eletrico",
  });
});

test("colado com emissão de dois níveis", () => {
  const c = separarCaminhoColado("P:\\cad\\prefchap\\040_26\\preventivo_incendio\\documentos\\1_inc\\1_emissão inicial_jun-2026");
  assert.equal(c?.emissao, "1_inc\\1_emissão inicial_jun-2026");
  assert.equal(c?.pasta, "preventivo_incendio");
});

test("colado sem documentos: a pasta inteira é a base", () => {
  const c = separarCaminhoColado("P:\\cad\\pmcriciuma\\156_25\\topografia");
  assert.deepEqual(c, { base: "P:\\cad\\pmcriciuma\\156_25\\topografia", emissao: "", cliente: "pmcriciuma", pasta: "topografia" });
});

test("texto que não é caminho não é colagem", () => {
  assert.equal(separarCaminhoColado("1_emissão inicial_out-25"), null);
});

test("colar no topo com disciplina reconhecida ajusta só ela", () => {
  const colado = separarCaminhoColado("P:\\cad\\pmcriciuma\\116_25\\cabeamento\\documentos\\1_x")!;
  const rede = aplicarColado({ emissao: "1_y" }, colado, ["elt", "cab", "cft"]);
  assert.equal(rede.emissao, "1_y");
  assert.deepEqual(rede.porDisciplina, { cab: { base: colado.base, emissao: "1_x" } });
  assert.equal(rede.cliente, "pmcriciuma");
});

test("colar no topo sem disciplina reconhecida vale como emissão de todas", () => {
  const colado = separarCaminhoColado("P:\\cad\\pmcriciuma\\116_25\\outra\\documentos\\2_z")!;
  const rede = aplicarColado({}, colado, ["elt", "cab"]);
  assert.equal(rede.emissao, "2_z");
  assert.equal(rede.porDisciplina, undefined);
});

test("colar numa linha substitui a dedução daquela disciplina", () => {
  const colado = separarCaminhoColado("P:\\cad\\pmcriciuma\\116_25\\gases medicinais\\documentos\\5_recebido")!;
  const rede = aplicarColado({}, colado, ["gme"], "gme");
  assert.deepEqual(rede.porDisciplina, { gme: { base: colado.base, emissao: "5_recebido" } });
});

test("caminho: sugestão quando nada foi decidido", () => {
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "elt", revisao: "a", rede: { mes: "OUTUBRO", ano: "2025" } }),
    "P:\\cad\\pmcriciuma\\116_25\\eletrico\\documentos\\1_emissão inicial_out-25\\116_25_elt_ld_a.odt",
  );
});

test("caminho: emissão do topo vence a sugestão", () => {
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "elt", revisao: "a", rede: { emissao: "1_emissao inicial_out.25" } }),
    "P:\\cad\\pmcriciuma\\116_25\\eletrico\\documentos\\1_emissao inicial_out.25\\116_25_elt_ld_a.odt",
  );
});

test("caminho: emissão vazia decidida = arquivo direto em documentos", () => {
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "elt", revisao: "a", rede: { emissao: "" } }),
    "P:\\cad\\pmcriciuma\\116_25\\eletrico\\documentos\\116_25_elt_ld_a.odt",
  );
});

test("caminho: a linha própria vence o topo", () => {
  const rede = { emissao: "1_y", porDisciplina: { cab: { emissao: "1_emissão inicial_out-2025" } } };
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "cab", revisao: "a", rede }),
    "P:\\cad\\pmcriciuma\\116_25\\cabeamento\\documentos\\1_emissão inicial_out-2025\\116_25_cab_ld_a.odt",
  );
});

test("caminho: o cliente colado vence o do modelo", () => {
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "113_22", disciplina: "elt", revisao: "a", rede: { cliente: "pmnavegantes", emissao: "" } }),
    "P:\\cad\\pmnavegantes\\113_22\\eletrico\\documentos\\113_22_elt_ld_a.odt",
  );
});

test("caminho: sigla fora da tabela não ganha emissão inventada", () => {
  assert.equal(
    caminhoDaLd({ cliente: "pmcriciuma", codigo: "116_25", disciplina: "xyz", revisao: "a", rede: { emissao: "1_y" } }),
    "P:\\cad\\pmcriciuma\\116_25\\116_25_xyz_ld_a.odt",
  );
});

test("caminho: sem cliente nenhum, nada", () => {
  assert.equal(caminhoDaLd({ codigo: "113_22", disciplina: "elt", revisao: "a" }), "");
});

test("lerRede tolera lixo; gravarRede de vazio é vazio", () => {
  assert.deepEqual(lerRede("não é json"), {});
  assert.deepEqual(lerRede(undefined), {});
  assert.deepEqual(lerRede({ emissao: 3, porDisciplina: { elt: { base: "P:\\x", emissao: 9 } } }), { porDisciplina: { elt: { base: "P:\\x" } } });
  assert.equal(gravarRede({}), "");
  const ida = { emissao: "1_x", porDisciplina: { cab: { emissao: "" } } };
  assert.deepEqual(lerRede(gravarRede(ida)), ida);
});

test("volume anterior da mesma revisão: tudo vale, inclusive a emissão", () => {
  const anterior = { cliente: "pmnavegantes", emissao: "1_x", revisao: "a", porDisciplina: { gme: { base: "P:\\cad\\pmnavegantes\\113_22\\climatizacao\\documentos", emissao: "1_y" } } };
  assert.deepEqual(redeDoVolumeAnterior(anterior, "a"), { ...anterior, origem: "volume-anterior" });
});

test("volume anterior de outra revisão: pastas valem, emissões voltam a ser sugeridas", () => {
  const anterior = { cliente: "pmnavegantes", emissao: "1_x", revisao: "a", porDisciplina: { gme: { base: "P:\\b", emissao: "1_y" }, cab: { emissao: "1_z" } } };
  assert.deepEqual(redeDoVolumeAnterior(anterior, "b"), {
    cliente: "pmnavegantes",
    revisao: "b",
    porDisciplina: { gme: { base: "P:\\b" } },
    origem: "volume-anterior",
  });
});

/*
 * O CAMINHO É PERGUNTA, NÃO SUPOSIÇÃO (16/10/2026).
 *
 * O plano mostrava o caminho deduzido com um ✓ e liberava o Gerar; a herança
 * do volume anterior se gravava sozinha. As LDs saíam com um rodapé que
 * ninguém tinha olhado. Agora só a confirmação de alguém libera.
 */
test("sem decisão, o caminho está pendente", () => {
  assert.equal(redePendente({}), true);
  assert.equal(redePendente(lerRede("")), true);
});

test("herdado do volume anterior continua pendente — é recomendação", () => {
  const anterior = { cliente: "pmnavegantes", emissao: "1_x", revisao: "a", confirmada: true as const };
  const herdada = redeDoVolumeAnterior(anterior, "a");
  assert.equal(herdada.confirmada, undefined);
  assert.equal(redePendente(herdada), true);
  assert.equal(herdada.origem, "volume-anterior");
  assert.equal(herdada.emissao, "1_x");
});

test("confirmar congela a emissão sugerida e esquece a origem", () => {
  const ok = confirmarRede({ origem: "volume-anterior", revisao: "a" }, "1_emissão inicial_out-26");
  assert.equal(redePendente(ok), false);
  assert.equal(ok.emissao, "1_emissão inicial_out-26");
  assert.equal(ok.origem, undefined);
  // A emissão decidida não é trocada pela sugestão.
  assert.equal(confirmarRede({ emissao: "2_x" }, "1_y").emissao, "2_x");
});

test("a confirmação sobrevive a gravar e ler", () => {
  const lida = lerRede(gravarRede(confirmarRede({ revisao: "a" }, "1_y")));
  assert.equal(lida.confirmada, true);
  assert.equal(redePendente(lida), false);
  assert.equal(lerRede(gravarRede({ origem: "volume-anterior", revisao: "a" })).origem, "volume-anterior");
  // Lixo não confirma.
  assert.equal(lerRede('{"confirmada":"sim"}').confirmada, undefined);
});

console.log(`\n${passed} testes passaram.`);
