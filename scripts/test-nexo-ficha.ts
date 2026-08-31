/**
 * A FICHA DO DROP — a identidade do projeto mostrada em vez de garimpada.
 *
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-ficha.ts   (== npm run test:nexo:ficha)
 */
import assert from "node:assert/strict";

import {
  dataPorExtenso,
  fichaDoDrop,
  prefeituraDoCarimbo,
} from "../modules/nexo/lib/ficha-do-drop.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const base = {
  recibo: "66 recebidas · 66 lidas",
  codigo: "088-25",
  obra: "EMEB JOSÉ GIASSI",
  folhas: Array.from({ length: 66 }, () => ({
    cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA",
    logoOrgao: "PREFEITURA MUNICIPAL DE CRICIÚMA",
  })),
  dataDoSelo: { mes: 5, ano: 2026 },
  nomesDasDisciplinas: ["PROJETO ESTRUTURAL METÁLICO"],
};

const valor = (f: ReturnType<typeof fichaDoDrop>, rotulo: string) =>
  [...f.identidade, ...f.propostos].find((l) => l.rotulo === rotulo);

// ------------------------------------------------------------------ o caso real

test("o caso do 088-25 sai inteiro", () => {
  const f = fichaDoDrop(base);
  assert.equal(valor(f, "Código")?.valor, "088-25");
  assert.equal(valor(f, "Obra")?.valor, "EMEB JOSÉ GIASSI");
  assert.equal(valor(f, "Prefeitura")?.valor, "PREFEITURA MUNICIPAL DE CRICIÚMA");
  assert.equal(valor(f, "Data do selo")?.valor, "MAIO/2026");
  assert.equal(valor(f, "Título da capa")?.valor, "PROJETO ESTRUTURAL METÁLICO");
  assert.equal(valor(f, "Título da LD")?.valor, "PROJETO ESTRUTURAL METÁLICO");
});

// ------------------------------------------------------- o que não foi lido FICA

test("campo não lido continua na ficha, marcado", () => {
  const f = fichaDoDrop({ ...base, obra: null, dataDoSelo: null });
  const obra = valor(f, "Obra");
  assert.equal(obra?.lido, false, "sumir da ficha faz concluir que está lá");
  assert.equal(obra?.valor, "não lido");
  assert.equal(valor(f, "Data do selo")?.lido, false);
});

test("a ficha tem SEMPRE as quatro linhas de identidade", () => {
  const vazia = fichaDoDrop({
    recibo: "1 recebida · 1 lida",
    codigo: null,
    obra: null,
    folhas: [{}],
    dataDoSelo: null,
    nomesDasDisciplinas: [],
  });
  assert.deepEqual(
    vazia.identidade.map((l) => l.rotulo),
    ["Código", "Obra", "Prefeitura", "Data do selo"],
  );
  assert.equal(vazia.propostos.length, 0, "sem disciplina não há título a propor");
});

// ------------------------------------------------------------------ a prefeitura

test("o brasão responde quando o campo CLIENTE não foi lido", () => {
  assert.equal(
    prefeituraDoCarimbo([{ cliente: null, logoOrgao: "PREFEITURA MUNICIPAL DE CRICIÚMA" }]),
    "PREFEITURA MUNICIPAL DE CRICIÚMA",
  );
});

test("uma folha reaproveitada não renomeia o volume", () => {
  const folhas = [
    ...Array.from({ length: 20 }, () => ({ cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA" })),
    { cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
  ];
  assert.equal(prefeituraDoCarimbo(folhas), "PREFEITURA MUNICIPAL DE CRICIÚMA");
});

// --------------------------------------------------------------- volume MISTO

test("volume misto: a capa lista, a LD é uma por disciplina", () => {
  /*
   * Seis dos oito volumes reais são mistos. Prometer o mesmo título nos dois
   * documentos anunciaria uma LD que não sai assim.
   */
  const f = fichaDoDrop({
    ...base,
    nomesDasDisciplinas: ["PROJETO HIDROSSANITÁRIO", "PROJETO PREVENTIVO"],
  });
  assert.equal(
    valor(f, "Título da capa")?.valor,
    "PROJETO HIDROSSANITÁRIO\nPROJETO PREVENTIVO",
  );
  assert.match(valor(f, "Título da LD")!.valor, /um por disciplina/);
});

// ------------------------------------------------------------------- a data

test("o mês vira nome, e mês fora da faixa não inventa", () => {
  assert.equal(dataPorExtenso({ mes: 3, ano: 2026 }), "MARÇO/2026");
  assert.equal(dataPorExtenso({ mes: 12, ano: 2025 }), "DEZEMBRO/2025");
  assert.equal(dataPorExtenso({ mes: 13, ano: 2026 }), "");
  assert.equal(dataPorExtenso(null), "");
});

test("o recibo atravessa intacto — a conta que fecha não é remontada aqui", () => {
  assert.equal(fichaDoDrop(base).recibo, "66 recebidas · 66 lidas");
});

console.log(`\n${passed} teste(s) ok`);
