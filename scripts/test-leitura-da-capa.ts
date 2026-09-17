/**
 * A CAPA DO MEMORIAL, lida sem IA. Os textos abaixo são a página 1 REAL de cada
 * memorial, como `extractPdfText` a entrega (17/09/2026).
 *
 *   node scripts/test-leitura-da-capa.ts   (== npm run test:leitura-da-capa)
 */
import assert from "node:assert/strict";

import { divergenciaDeCodigo, lerCapa } from "../lib/leitura-da-capa.ts";

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

const pagina = (p1: string) => `--- PAGINA 1 ---\n${p1}\n\n--- PAGINA 2 ---\nSumário\n`;

test("027_24 São José: nome em 3 linhas, secretaria separada, mês sem barra", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE SÃO JOSÉ\nSECRETARIA MUNICIPAL DE INFRAESTRUTURA\nBEIRA MAR DE SÃO JOSÉ - BARREIROS\nURBANIZAÇÃO DA ORLA - PARQUE,\nRESTAURANTE E LANCHONETE\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nOUTUBRO 2025\n027-24\n",
    ),
  );
  assert.deepEqual(capa, {
    orgao: "PREFEITURA MUNICIPAL DE SÃO JOSÉ",
    secretaria: "SECRETARIA MUNICIPAL DE INFRAESTRUTURA",
    municipio: "SÃO JOSÉ",
    obra: "BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE",
    bairro: "",
    mesAno: "OUTUBRO 2025",
    codigo: "027-24",
  });
});

test("040_26 Chapecó: código com sublinhado sai com hífen", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE CHAPECÓ\nSECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO\nREVITALIZAÇÃO DA FEIRA MUNICIPAL\nDE CHAPECÓ\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nJUNHO/2024\n040_26\n",
    ),
  );
  assert.equal(capa?.obra, "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ");
  assert.equal(capa?.secretaria, "SECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO");
  assert.equal(capa?.municipio, "CHAPECÓ");
  assert.equal(capa?.mesAno, "JUNHO/2024");
  assert.equal(capa?.codigo, "040-26");
});

test("113_22 Navegantes: prefeitura sem modelo cadastrado também é lida", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE NAVEGANTES\nSECRETARIA MUNICIPAL DE PLANEJAMENTO URBANO\nHOSPITAL MUNICIPAL NOSSA SENHORA\nDOS NAVEGANTES\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nMAIO/2023\n113-22\n",
    ),
  );
  assert.equal(capa?.orgao, "PREFEITURA MUNICIPAL DE NAVEGANTES");
  assert.equal(capa?.obra, "HOSPITAL MUNICIPAL NOSSA SENHORA DOS NAVEGANTES");
});

const CRICIUMA_116 =
  "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nUBS RENASCER - PORTE 2\nBAIRRO SÃO JOÃO\nVOLUME 1 – MEMORIAL DESCRITIVO\n116-25\nOUTUBRO/2025\n- Projetos, Supervisão e Planejamento Ltda\n";

test("116_25 Criciúma: timbre espaçado ganha a grafia do candidato", () => {
  assert.deepEqual(lerCapa(pagina(CRICIUMA_116), ["", "Criciúma"]), {
    orgao: "PREFEITURA MUNICIPAL DE CRICIÚMA",
    secretaria: "",
    municipio: "Criciúma",
    obra: "UBS RENASCER - PORTE 2",
    bairro: "BAIRRO SÃO JOÃO",
    mesAno: "OUTUBRO/2025",
    codigo: "116-25",
  });
});

test("timbre espaçado sem candidato que case: município e órgão vazios, obra lida", () => {
  const capa = lerCapa(pagina(CRICIUMA_116), ["Içara"]);
  assert.equal(capa?.municipio, "");
  assert.equal(capa?.orgao, "");
  assert.equal(capa?.obra, "UBS RENASCER - PORTE 2");
});

test("116_25 terraplenagem: o nome termina no bairro, subtítulos não entram", () => {
  const capa = lerCapa(
    pagina(
      "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nUBS RENASCER - PORTE 2\nBAIRRO SÃO JOÃO\nTERRAPLENAGEM / DESENHO GEOMÉTRICO\nPROJETO DE PAVIMENTAÇÃO\nMEMORIAL DESCRITIVO E PROJETOS\n116-25\nOUTUBRO/2025\n- Projetos, Supervisão e Planejamento Ltda\n",
    ),
    ["Criciúma"],
  );
  assert.equal(capa?.obra, "UBS RENASCER - PORTE 2");
  assert.equal(capa?.bairro, "BAIRRO SÃO JOÃO");
});

test("156_25: sem bairro, MARÇO com cedilha", () => {
  const capa = lerCapa(
    pagina(
      "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nNOVA SEDE DA DEFESA CIVIL\nVOLUME 1 – MEMORIAL DESCRITIVO\n156-25\nMARÇO/2026\n- Projetos, Supervisão e Planejamento Ltda\n",
    ),
    ["Criciúma"],
  );
  assert.equal(capa?.obra, "NOVA SEDE DA DEFESA CIVIL");
  assert.equal(capa?.bairro, "");
  assert.equal(capa?.mesAno, "MARÇO/2026");
});

test("kit de erros plantados (capa achatada) não é lido: null, e o fallback decide", () => {
  const kit =
    "E S T A D O D E S A N T A C A T A R I N A G O V E R N O D O M U N I C Í P I\nO D E C R I C I Ú M A UBS RENASCER - PORTE 2 BAIRRO SÃO JOÃO\nVOLUME 1 - MEMORIAL DESCRITIVO 116-25 OUTUBRO/2025 - Projetos,\nSupervisão e Planejamento Ltda\n";
  assert.equal(lerCapa(pagina(kit), ["Criciúma"]), null);
  assert.equal(
    lerCapa(
      pagina(
        "ESTADO DE SANTA CATARINA PREFEITURA MUNICIPAL DE CRICIUMA\nSECRETARIA MUNICIPAL DE SAUDE UBS RENASCER - PORTE 2\nVOLUME 1 - MEMORIAL DESCRITIVO 116-25 OUTUBRO/2025\n",
      ),
    ),
    null,
  );
});

test("página 1 que é sumário não é capa", () => {
  assert.equal(lerCapa(pagina("Sumário\n1 APRESENTAÇÃO........ 12\n")), null);
});

test("timbre sem âncora de fim não é capa", () => {
  assert.equal(lerCapa(pagina("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nALGUMA COISA\nOUTRA COISA\n")), null);
});

test("sem o marcador de página não há página 1: null", () => {
  assert.equal(lerCapa("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nOBRA\nPROJETO EXECUTIVO"), null);
});

test("só a página 1 conta: capa na página 2 é ignorada", () => {
  const texto =
    "--- PAGINA 1 ---\n116-25\n\n--- PAGINA 2 ---\nPREFEITURA MUNICIPAL DE SÃO JOSÉ\nOBRA QUALQUER\nPROJETO EXECUTIVO\n";
  assert.equal(lerCapa(texto), null);
});

test("nome com mais de 4 linhas não é nome: obra vazia, o resto vale", () => {
  const capa = lerCapa(
    pagina("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nA1\nA2\nA3\nA4\nA5\nPROJETO EXECUTIVO\n027-24\n"),
  );
  assert.equal(capa?.obra, "");
  assert.equal(capa?.codigo, "027-24");
});

test("divergência de código: iguais com _ ou - não divergem", () => {
  assert.equal(divergenciaDeCodigo("027_24", "027-24"), null);
  assert.equal(divergenciaDeCodigo("", "027-24"), null);
  assert.equal(divergenciaDeCodigo("027-24", ""), null);
});

test("divergência de código: diferentes viram o sinal", () => {
  assert.equal(
    divergenciaDeCodigo("116-25", "117-25"),
    "código da capa (117-25) diverge do nome do arquivo (116-25)",
  );
});

console.log(`\n${passed} teste(s) de leitura da capa OK`);
