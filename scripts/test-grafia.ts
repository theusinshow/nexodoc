/**
 * GRAFIA NAS PRANCHAS — o núcleo puro (16/10/2026).
 *
 * O caso que motivou: "QUADRA DE BOXA" num volume de topografia de
 * terceirizado. "Boxa" existe no dicionário (verbo boxar) — quem acha é a IA,
 * pelo contexto. O núcleo é o que impede a IA de inventar e o dicionário de
 * gritar: remoção de repetição, trava do literal, mescla das duas fontes.
 *
 *   node scripts/test-grafia.ts   (== npm run test:grafia)
 */
import assert from "node:assert/strict";

import {
  comGrafia,
  linhaLegivel,
  linhasUnicas,
  montarResultadoDaGrafia,
  palavrasParaDicionario,
  type TextoDaFolha,
} from "../server/nexo/grafia-core.ts";

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

const folha = (arquivo: string, pagina: number, textos: string[], recuperada = false): TextoDaFolha => ({
  arquivo,
  pagina,
  itens: textos.map((texto) => ({ texto, recuperada })),
});

// --- Extração ------------------------------------------------------------------

test("linha repetida no volume vira uma só, com todas as folhas", () => {
  const r = linhasUnicas([
    folha("a.pdf", 1, ["TODAS AS MEDIDAS DEVEM SER CONFIRMADAS NO LOCAL;", "QUADRA DE BOXA"]),
    folha("a.pdf", 2, ["TODAS AS  MEDIDAS DEVEM SER CONFIRMADAS NO LOCAL;"]),
    folha("b.pdf", 1, ["QUADRA DE BOXA"]),
  ]);
  assert.equal(r.linhas.length, 2);
  const boxa = r.linhas.find((l) => l.texto === "QUADRA DE BOXA")!;
  assert.deepEqual(boxa.ocorrencias, [
    { arquivo: "a.pdf", pagina: 1 },
    { arquivo: "b.pdf", pagina: 1 },
  ]);
  assert.equal(r.folhasLidas, 3);
  assert.equal(r.folhasTotal, 3);
});

test("cota, número e fonte embaralhada não são texto", () => {
  assert.equal(linhaLegivel("NV -0,12"), false);
  assert.equal(linhaLegivel("2-CB1"), false);
  assert.equal(linhaLegivel("35()(,785$081,&,3$/'(&+$3(&Ï"), false);
  assert.equal(linhaLegivel("5XD6DOGDQKD0DULQKR(GLItFLR/LEHUDO"), false);
  assert.equal(linhaLegivel("PASSARELA 3"), true);
  assert.equal(linhaLegivel("deve-se inverter os sinais positivos e/ou negativos"), true);
});

test("teto de texto: o que não coube é dito, não calado", () => {
  const muitas = Array.from({ length: 10 }, (_, i) =>
    folha(`f${i}.pdf`, 1, [`TEXTO UNICO NUMERO ${"X".repeat(i + 1)} DA FOLHA`]),
  );
  const r = linhasUnicas(muitas, 120);
  assert.ok(r.folhasLidas < 10 && r.folhasLidas > 0, `lidas ${r.folhasLidas}`);
  assert.equal(r.folhasTotal, 10);
  const res = montarResultadoDaGrafia({ ...r, erros: [], suspeitas: [], juizos: [] });
  assert.ok(res.findings.some((f) => /grafia conferida em \d+ de 10 folhas/i.test(f.mensagem)));
});

// --- Dicionário ----------------------------------------------------------------

test("só palavra vai ao dicionário: sigla, código e identificador ficam fora", () => {
  assert.deepEqual(
    palavrasParaDicionario("PERFIS LAMINADOS = ASTM A572-50 Comb1 PesoProprio NBR luminaria"),
    ["PERFIS", "LAMINADOS", "luminaria"],
  );
  assert.deepEqual(palavrasParaDicionario("boca-de-lobo, meio-fio;"), ["boca-de-lobo", "meio-fio"]);
});

// --- Mescla e trava ------------------------------------------------------------

const base = () =>
  linhasUnicas([
    folha("top_001.pdf", 3, ["QUADRA DE BOXA", "TUBULACAO EXISTENTE", "MAGUEIRA DE INCENDIO"]),
    folha("top_002.pdf", 7, ["QUADRA DE BOXA", "RUA SALDANHA MARINHO"]),
    folha("top_003.pdf", 1, ["REVITALIZAdO DA PRAÇA DO CENTOR"], true),
  ]);

test("o caso real: erro de contexto vira aviso apontando as folhas", () => {
  const r = base();
  const n = r.linhas.find((l) => l.texto === "QUADRA DE BOXA")!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [{ linha: n, errado: "BOXA", certo: "BOCHA", motivo: "quadra de bocha (o jogo)" }],
    suspeitas: [],
    juizos: [],
  });
  assert.equal(res.veredito, "aviso");
  const f = res.findings.find((x) => x.campo === "grafia")!;
  assert.equal(f.severidade, "aviso");
  assert.match(f.mensagem, /"BOXA" → "BOCHA"/);
  assert.deepEqual(f.folhas, ["top_001.pdf", "top_002.pdf"]);
  assert.match(f.detalhe ?? "", /QUADRA DE BOXA/);
});

test("a IA não inventa: trecho que não está na linha cai", () => {
  const r = base();
  const n = r.linhas.find((l) => l.texto === "QUADRA DE BOXA")!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [
      { linha: n, errado: "QUADRADO", certo: "QUADRA", motivo: "x" },
      { linha: n, errado: "BOXA", certo: "boxa", motivo: "igual" },
      { linha: 999, errado: "BOXA", certo: "BOCHA", motivo: "linha inexistente" },
    ],
    suspeitas: [],
    juizos: [],
  });
  assert.equal(res.findings.length, 0);
  assert.equal(res.veredito, "ok");
});

test("linha de fonte recuperada: acento e artefato do reparo não valem", () => {
  const r = base();
  const n = r.linhas.find((l) => l.recuperada)!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [
      { linha: n, errado: "PRAÇA", certo: "PRACA", motivo: "acento" },
      // O reparo desloca o acento para uma minúscula: é do reparo, não do papel.
      { linha: n, errado: "REVITALIZAdO", certo: "REVITALIZAÇÃO", motivo: "letras" },
      { linha: n, errado: "CENTOR", certo: "CENTRO", motivo: "letras trocadas" },
    ],
    suspeitas: [],
    juizos: [],
  });
  assert.equal(res.findings.length, 1);
  assert.match(res.findings[0].mensagem, /"CENTOR" → "CENTRO"/);
});

test("suspeita do dicionário: erro vira aviso, nome some, sem juízo vira info", () => {
  const r = base();
  const linhaDe = (t: string) => r.linhas.find((l) => l.texto === t)!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [],
    suspeitas: [
      { palavra: "MAGUEIRA", linhas: [linhaDe("MAGUEIRA DE INCENDIO")] },
      { palavra: "SALDANHA", linhas: [linhaDe("RUA SALDANHA MARINHO")] },
      { palavra: "MARINHO", linhas: [linhaDe("RUA SALDANHA MARINHO")] },
    ],
    juizos: [
      { palavra: "magueira", erro: true, certo: "MANGUEIRA" },
      { palavra: "SALDANHA", erro: false, certo: null },
    ],
  });
  const msgs = res.findings.map((f) => `${f.severidade}:${f.mensagem}`);
  assert.ok(msgs.some((m) => /^aviso:"MAGUEIRA" → "MANGUEIRA"/.test(m)), msgs.join("\n"));
  assert.ok(!msgs.some((m) => /SALDANHA/.test(m)), msgs.join("\n"));
  assert.ok(msgs.some((m) => /^info:.*"MARINHO".*fora do dicionário/.test(m)), msgs.join("\n"));
});

test("o mesmo erro achado pela IA e pelo dicionário sai uma vez", () => {
  const r = base();
  const n = r.linhas.find((l) => l.texto === "TUBULACAO EXISTENTE")!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [{ linha: n, errado: "TUBULACAO", certo: "TUBULAÇÃO", motivo: "falta cedilha e til" }],
    suspeitas: [{ palavra: "TUBULACAO", linhas: [n] }],
    juizos: [{ palavra: "TUBULACAO", erro: true, certo: "TUBULAÇÃO" }],
  });
  assert.equal(res.findings.filter((f) => /TUBULACAO/.test(f.mensagem)).length, 1);
});

/*
 * SÓ ACENTO É INFO. Desenho de CAD sai muito sem acento ("RESISTENCIA",
 * "NIVEL", "ELETRICA" — medido nas amostras): como aviso, afogaria o erro de
 * letra, que é o que muda o sentido. Continua listado, abaixo dos avisos.
 */
test("erro só de acento é info; de letra é aviso", () => {
  const r = base();
  const n = r.linhas.find((l) => l.texto === "TUBULACAO EXISTENTE")!.n;
  const m = r.linhas.find((l) => l.texto === "MAGUEIRA DE INCENDIO")!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [
      { linha: n, errado: "TUBULACAO", certo: "TUBULAÇÃO", motivo: "acento" },
      { linha: m, errado: "MAGUEIRA", certo: "MANGUEIRA", motivo: "falta o N" },
    ],
    suspeitas: [],
    juizos: [],
  });
  assert.deepEqual(
    res.findings.map((f) => `${f.severidade}:${f.mensagem}`),
    ['aviso:"MAGUEIRA" → "MANGUEIRA"', 'info:"TUBULACAO" → "TUBULAÇÃO"'],
  );
});

test("a grafia entra na conferência leve; falha vira aviso, não silêncio", () => {
  const leve = { veredito: "ok" as const, findings: [] };
  const r = base();
  const n = r.linhas.find((l) => l.texto === "QUADRA DE BOXA")!.n;
  const grafia = montarResultadoDaGrafia({
    ...r,
    erros: [{ linha: n, errado: "BOXA", certo: "BOCHA", motivo: "" }],
    suspeitas: [],
    juizos: [],
  });
  const junta = comGrafia(leve, grafia);
  assert.equal(junta.veredito, "aviso");
  assert.equal(junta.findings.length, 1);

  const critica = { veredito: "critico" as const, findings: [{ severidade: "critico" as const, campo: "codigo", mensagem: "x" }] };
  assert.equal(comGrafia(critica, grafia).veredito, "critico");

  const falhou = comGrafia(leve, { erro: "teto mensal" });
  assert.equal(falhou.veredito, "aviso");
  assert.match(falhou.findings[0].mensagem, /Grafia não conferida: teto mensal/);

  // Só info (acento) não muda o veredito.
  const soInfo = { ...grafia, veredito: "ok" as const, findings: [{ severidade: "info" as const, campo: "grafia", mensagem: "y" }] };
  assert.equal(comGrafia(leve, soInfo).veredito, "ok");
});

/*
 * ARTEFATO DE CODIFICAÇÃO NÃO É ERRO (16/10/2026, corrida real do 138-26).
 *
 * A fonte do CAD desenha "Cerâmica" certo no papel, mas a camada de texto do
 * PDF diz "Cerkmica": a letra acentuada vira OUTRA letra (â→k, Ç→d, é→p) ou
 * some. Quem esquece acento escreve a letra-base (ç→c) — isso continua info.
 */
test("letra acentuada trocada por outra letra é a fonte, não o papel", () => {
  const r = linhasUnicas([
    folha("met.pdf", 1, [
      "Cerkmica esmaltada",
      "IdAMENTO DAS PECAS",
      "chappu chinês",
      "1 EMISSO INICIAL",
      "reacoes smo positivas",
      "TUBULACAO EXISTENTE",
      "MAGUEIRA DE INCENDIO",
    ]),
  ]);
  const n = (t: string) => r.linhas.find((l) => l.texto === t)!.n;
  const res = montarResultadoDaGrafia({
    ...r,
    erros: [
      { linha: n("Cerkmica esmaltada"), errado: "Cerkmica", certo: "Cerâmica", motivo: "" },
      { linha: n("IdAMENTO DAS PECAS"), errado: "IdAMENTO", certo: "IÇAMENTO", motivo: "" },
      { linha: n("chappu chinês"), errado: "chappu", certo: "chapéu", motivo: "" },
      { linha: n("1 EMISSO INICIAL"), errado: "EMISSO", certo: "EMISSÃO", motivo: "" },
      { linha: n("reacoes smo positivas"), errado: "smo", certo: "são", motivo: "" },
      { linha: n("TUBULACAO EXISTENTE"), errado: "TUBULACAO", certo: "TUBULAÇÃO", motivo: "" },
      { linha: n("MAGUEIRA DE INCENDIO"), errado: "MAGUEIRA", certo: "MANGUEIRA", motivo: "" },
    ],
    suspeitas: [{ palavra: "Cerkmica", linhas: [n("Cerkmica esmaltada")] }],
    juizos: [{ palavra: "Cerkmica", erro: true, certo: "Cerâmica" }],
  });
  assert.deepEqual(
    res.findings.map((f) => `${f.severidade}:${f.mensagem}`),
    ['aviso:"MAGUEIRA" → "MANGUEIRA"', 'info:"TUBULACAO" → "TUBULAÇÃO"'],
  );
});

console.log(`\n${passed} teste(s) de grafia OK`);
