/**
 * TODO "REGENERAR" RESPEITA A ABA TRAVADA — 15/09/2026, depois da segunda rodada.
 *
 * A revisão final travou o "Regenerar" do volume (`VolumeConfirmation`) e o do
 * plano (`PlanoDeGeracao`), mas os outros cartões que passam `onRegerar` ao
 * `ResultLinks` — LD, capa, separatriz — ficaram com o botão ativo e o
 * `confirm` sem trava. Numa aba travada o clique gerava o documento e a fila de
 * gravação o descartava: o botão parecia funcionar e o arquivo sumia calado. O
 * mesmo vale para o "Auditar de novo" da âncora do parecer, que abre uma
 * rodada nova na conversa que esta aba já não grava.
 *
 * O teste lê o código-fonte: é a forma de pegar o PRÓXIMO cartão que ganhar
 * `onRegerar` sem a trava, antes de alguém clicar nele numa aba travada.
 *
 *   node scripts/test-regerar-com-trava.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

const PASTA = "modules/nexo/components";
const fontes = fs
  .readdirSync(PASTA)
  .filter((n) => n.endsWith(".tsx"))
  .map((n) => ({
    arquivo: path.join(PASTA, n),
    texto: fs.readFileSync(path.join(PASTA, n), "utf8"),
  }));

/** Os blocos `<ResultLinks ... />` de um arquivo, com a linha onde começam. */
function blocosDeResultLinks(texto: string) {
  const blocos: { linha: number; bloco: string }[] = [];
  const re = /<ResultLinks\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const fim = texto.indexOf("/>", m.index);
    blocos.push({
      linha: texto.slice(0, m.index).split("\n").length,
      bloco: texto.slice(m.index, fim),
    });
  }
  return blocos;
}

/** O corpo do componente (`function Nome(`) que contém a posição dada. */
function componenteEm(texto: string, indice: number) {
  const inicio = texto.lastIndexOf("\nfunction ", indice);
  const proximo = texto.indexOf("\nfunction ", indice);
  const corpo = texto.slice(inicio, proximo === -1 ? undefined : proximo);
  const nome = /\nfunction (\w+)/.exec(corpo)?.[1] ?? "?";
  return { nome, corpo };
}

test("todo <ResultLinks> com onRegerar diz por que o botão está cinza na aba travada", () => {
  const faltando: string[] = [];
  for (const { arquivo, texto } of fontes) {
    for (const { linha, bloco } of blocosDeResultLinks(texto)) {
      if (!bloco.includes("onRegerar=")) continue;
      if (!/motivoRegerarBloqueado=\{[^}]*podeGastar/.test(bloco)) {
        faltando.push(`${arquivo}:${linha}`);
      }
    }
  }
  assert.deepEqual(
    faltando,
    [],
    `sem motivoRegerarBloqueado ligado a podeGastar: ${faltando.join(", ")}`,
  );
});

test("o confirm que o Regenerar chama recusa sozinho na aba travada (o botão não é a única porta)", () => {
  const faltando: string[] = [];
  const texto = fs.readFileSync(
    path.join(PASTA, "ConfirmationCard.tsx"),
    "utf8",
  );
  for (const { linha, bloco } of blocosDeResultLinks(texto)) {
    if (!/onRegerar=\{confirm\}/.test(bloco)) continue;
    const { nome, corpo } = componenteEm(
      texto,
      texto.split("\n").slice(0, linha).join("\n").length,
    );
    const confirm = corpo.slice(corpo.indexOf("async function confirm("));
    const cabeca = confirm.slice(0, confirm.indexOf("setBusy(true)"));
    if (!cabeca.includes("if (!podeGastar)")) faltando.push(nome);
  }
  assert.deepEqual(
    faltando,
    [],
    `confirm sem a trava antes de começar: ${faltando.join(", ")}`,
  );
});

test("'Auditar de novo' não aparece na aba travada", () => {
  const texto = fs.readFileSync(
    path.join(PASTA, "ConfirmationCard.tsx"),
    "utf8",
  );
  const usos = [...texto.matchAll(/onAuditarDeNovo=\{([^}]*)\}/g)].map(
    (m) => m[1],
  );
  assert.ok(usos.length > 0, "nenhum uso de onAuditarDeNovo achado");
  for (const uso of usos)
    assert.match(uso, /podeGastar/, `onAuditarDeNovo={${uso}}`);
});

console.log(`\n${passed} ok`);
