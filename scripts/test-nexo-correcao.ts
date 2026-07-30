/**
 * Smoke-test dos módulos PUROS da correção manual e do estado dos anexos.
 *
 *   node scripts/test-nexo-correcao.ts   (== npm run test:nexo:correcao)
 *
 * Estes três módulos foram escritos e subiram sem teste. Todos são puros e sem
 * imports de runtime, então não havia desculpa — e todos decidem TEXTO que o
 * engenheiro lê para tomar decisão sobre um documento que já pode ter ido para
 * a prefeitura.
 */
import assert from "node:assert/strict";

import {
  consequenciaDaMudanca,
  haQuantoTempo,
  mudancasDoArtefato,
  tamanhoLegivel,
} from "../modules/nexo/lib/pendencia.ts";
import { estadoDoAnexo } from "../modules/nexo/lib/estado-do-anexo.ts";
import {
  corDaDisciplina,
  siglaDaDisciplina,
} from "../modules/nexo/lib/disciplina-cor.ts";

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

// --- O que mudou desde a geração --------------------------------------------

test("mudancasDoArtefato: só o que mudou, com rótulo legível", () => {
  const r = mudancasDoArtefato(
    { tituloLd: "PROJETO ARQUITETONICO", numTomos: 2 },
    { tituloLd: "PROJETO ARQ. — REVITALIZAÇÃO", numTomos: 2 },
  );
  assert.deepEqual(r, [
    {
      campo: "Título",
      antes: "PROJETO ARQUITETONICO",
      depois: "PROJETO ARQ. — REVITALIZAÇÃO",
    },
  ]);
});

test("mudancasDoArtefato: nada mudou -> lista vazia (o card não acusa à toa)", () => {
  assert.deepEqual(mudancasDoArtefato({ numTomos: 2 }, { numTomos: 2 }), []);
});

test("mudancasDoArtefato: valor que APARECE conta como mudança", () => {
  // "—" → "2026" é exatamente o caso "faltava o ano e agora tem".
  const r = mudancasDoArtefato({ ano: "" }, { ano: "2026" });
  assert.deepEqual(r, [{ campo: "Ano", antes: "—", depois: "2026" }]);
});

test("mudancasDoArtefato: campo sem rótulo conhecido não vira linha", () => {
  // `tomo` e a assinatura das folhas disparam a pendência, mas não são o que o
  // engenheiro lê — mostrá-los encheria o aviso de ruído técnico.
  assert.deepEqual(mudancasDoArtefato({ tomo: 1 }, { tomo: 2 }), []);
});

test("mudancasDoArtefato: entrada inválida não quebra", () => {
  assert.deepEqual(mudancasDoArtefato(undefined, { tituloLd: "X" }), []);
  assert.deepEqual(mudancasDoArtefato({ tituloLd: "X" }, null), []);
});

test("mudancasDoArtefato: lista vira texto legível", () => {
  const r = mudancasDoArtefato({ titulos: ["A", "B"] }, { titulos: ["A", "C"] });
  assert.deepEqual(r, [{ campo: "Disciplinas", antes: "A, B", depois: "A, C" }]);
});

// --- Tempo e tamanho ---------------------------------------------------------

test("haQuantoTempo: minutos, horas, ontem", () => {
  const agora = 1_000_000_000_000;
  assert.equal(haQuantoTempo(agora - 42 * 60_000, agora), "há 42 min");
  assert.equal(haQuantoTempo(agora - 3 * 3_600_000, agora), "há 3 h");
  assert.equal(haQuantoTempo(agora - 26 * 3_600_000, agora), "ontem");
  assert.equal(haQuantoTempo(agora - 5_000, agora), "agora há pouco");
});

test("tamanhoLegivel: B, KB e MB com vírgula decimal", () => {
  assert.equal(tamanhoLegivel(512), "512 B");
  assert.equal(tamanhoLegivel(98_304), "96 KB");
  assert.equal(tamanhoLegivel(19_293_798), "18,4 MB");
  assert.equal(tamanhoLegivel(undefined), "");
});

// --- A frase de consequência -------------------------------------------------

test("consequenciaDaMudanca: prefeitura fala do modelo por órgão", () => {
  const frase = consequenciaDaMudanca("capa", [
    { campo: "Prefeitura", antes: "Chapecó", depois: "São Miguel" },
  ]);
  assert.match(frase, /modelo de capa/i);
});

test("consequenciaDaMudanca: título fala do protocolo", () => {
  const frase = consequenciaDaMudanca("ld", [
    { campo: "Título", antes: "A", depois: "B" },
  ]);
  assert.match(frase, /protocolo/i);
});

test("consequenciaDaMudanca: prefeitura tem precedência sobre título", () => {
  // Trocar a prefeitura é a mudança mais cara: muda o MODELO do documento.
  const frase = consequenciaDaMudanca("capa", [
    { campo: "Título", antes: "A", depois: "B" },
    { campo: "Prefeitura", antes: "X", depois: "Y" },
  ]);
  assert.match(frase, /modelo de capa/i);
});

test("consequenciaDaMudanca: sempre devolve frase (nunca vazio)", () => {
  assert.ok(consequenciaDaMudanca("ld", []).length > 10);
});

// --- Estado do anexo ---------------------------------------------------------

const sigla = (d: string | null | undefined) => siglaDaDisciplina(d);

test("estadoDoAnexo: sem resultado e lendo -> na fila", () => {
  assert.deepEqual(estadoDoAnexo("a.pdf", [], true, sigla), { tipo: "na-fila" });
});

test("estadoDoAnexo: sem resultado e parado -> nenhum (o memorial não é lido)", () => {
  assert.deepEqual(estadoDoAnexo("md.pdf", [], false, sigla), { tipo: "nenhum" });
});

test("estadoDoAnexo: lido mostra sigla e folha", () => {
  const r = estadoDoAnexo(
    "a.pdf",
    [{ fileName: "a.pdf", extraction: { disciplina: "Arquitetonico", numeroFolha: "05/24" } }],
    false,
    sigla,
  );
  assert.deepEqual(r, { tipo: "lido", sigla: "ARQ", folha: "05/24" });
});

test("estadoDoAnexo: resultado sem leitura -> selo ilegível", () => {
  const r = estadoDoAnexo("a.pdf", [{ fileName: "a.pdf", extraction: null }], false, sigla);
  assert.deepEqual(r, { tipo: "ilegivel" });
});

test("estadoDoAnexo: uma página lida entre várias ilegíveis ainda conta como lido", () => {
  // PDF combinado: basta uma folha boa para o arquivo não ser "ilegível".
  const r = estadoDoAnexo(
    "tomo.pdf",
    [
      { fileName: "tomo.pdf", extraction: null },
      { fileName: "tomo.pdf", extraction: { disciplina: "Estrutural", numeroFolha: "11/24" } },
    ],
    false,
    sigla,
  );
  assert.deepEqual(r, { tipo: "lido", sigla: "EST", folha: "11/24" });
});

test("estadoDoAnexo: não confunde arquivos diferentes", () => {
  const selos = [{ fileName: "outro.pdf", extraction: { disciplina: "Arq", numeroFolha: "1/2" } }];
  assert.deepEqual(estadoDoAnexo("a.pdf", selos, true, sigla), { tipo: "na-fila" });
});

// --- Disciplina: sigla e cor -------------------------------------------------

test("siglaDaDisciplina: casa as oito famílias do escritório", () => {
  assert.equal(siglaDaDisciplina("Arquitetonico"), "ARQ");
  assert.equal(siglaDaDisciplina("ESTRUTURAL"), "EST");
  assert.equal(siglaDaDisciplina("Hidrossanitário"), "HID");
  assert.equal(siglaDaDisciplina("Elétrico"), "ELE");
  assert.equal(siglaDaDisciplina("Preventivo contra incêndio"), "PCI");
  assert.equal(siglaDaDisciplina("Climatização"), "CLI");
  assert.equal(siglaDaDisciplina("Terraplenagem"), "TER");
  assert.equal(siglaDaDisciplina("Paisagismo"), "PAI");
});

test("siglaDaDisciplina: acento não atrapalha o casamento", () => {
  assert.equal(siglaDaDisciplina("HIDROSSANITÁRIO"), "HID");
  assert.equal(corDaDisciplina("Hidrossanitário"), "var(--discipline-hid)");
});

test("siglaDaDisciplina: fora das famílias -> três letras, sem cor", () => {
  assert.equal(siglaDaDisciplina("Maquete"), "MAQ");
  assert.equal(corDaDisciplina("Maquete"), null, "sem cor é melhor que cor errada");
});

test("disciplina vazia não vira sigla nem cor", () => {
  assert.equal(siglaDaDisciplina(null), "");
  assert.equal(corDaDisciplina(undefined), null);
});

test("famílias afins caem na mesma cor (agrupamento por família)", () => {
  // Fôrmas e fundações são estrutura; drenagem e pavimentação são terra.
  assert.equal(corDaDisciplina("Fundacoes"), corDaDisciplina("Estrutural"));
  assert.equal(corDaDisciplina("Drenagem"), corDaDisciplina("Terraplenagem"));
});

console.log(`\n${passed} teste(s) passaram.`);
