// A IDENTIDADE DE CADA MEMORIAL DO ACERVO, antes e depois de mexer no leitor.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/medir-identidade-do-memorial.mjs \
//     [--salvar antes.json] [--comparar antes.json] [pdf extra ...]
//   (== npm run medir:identidade -- ...)
//
// Sem IA. Lê `docs/samples/**/1_memorial`, `docs/samples/**/ter_pav` e o kit de
// erros plantados, mais os PDFs passados por argumento. Toda mudança de campo é
// listada: uma mudança que ninguém esperava é investigada antes de subir.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

const { extractPdfText } = await import("../lib/pdf-text.ts");
const { classifyDocument } = await import("../lib/audit-classify.ts");

const CAMPOS = ["obra", "orgao", "secretaria", "municipio", "bairro", "mesAno", "codigo"];
const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i === -1 ? null : args.splice(i, 2)[1];
};
const salvar = opcao("--salvar");
const comparar = opcao("--comparar");

const arquivos = [];
for (const projeto of readdirSync("docs/samples", { withFileTypes: true })) {
  if (!projeto.isDirectory()) continue;
  for (const sub of ["1_memorial", "ter_pav"]) {
    const dir = join("docs/samples", projeto.name, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      // Só memorial: `ter_pav` guarda também pranchas, LD e separatriz.
      if (/_md_.*\.pdf$/i.test(f) && !/assinado/i.test(f)) arquivos.push(join(dir, f));
    }
  }
}
const kit = "docs/samples/_auditoria-teste";
if (existsSync(kit)) {
  for (const f of readdirSync(kit)) if (f.endsWith(".pdf")) arquivos.push(join(kit, f));
}
arquivos.push(...args);

const medida = {};
for (const f of arquivos) {
  const extraido = await extractPdfText(readFileSync(f));
  // Toda prova de medição precisa asserir que HOUVE medida (nexodoc-pre-voo-do-anexo).
  if (!(extraido.pageCount > 0)) throw new Error(`nada extraído de ${f}: a medida seria vazia`);
  const doc = classifyDocument(basename(f), extraido, "memorial");
  medida[basename(f)] = Object.fromEntries(CAMPOS.map((c) => [c, doc[c] ?? ""]));
  medida[basename(f)].capaLida = Boolean(doc.capa);
}

if (salvar) writeFileSync(salvar, JSON.stringify(medida, null, 1));
if (comparar) {
  const antes = JSON.parse(readFileSync(comparar, "utf8"));
  let mudancas = 0;
  for (const [nome, depois] of Object.entries(medida)) {
    for (const campo of [...CAMPOS, "capaLida"]) {
      const a = antes[nome]?.[campo] ?? "";
      if (String(a) !== String(depois[campo])) {
        mudancas++;
        console.log(
          `${nome} · ${campo}\n   antes: ${JSON.stringify(a)}\n  depois: ${JSON.stringify(depois[campo])}`,
        );
      }
    }
  }
  console.log(`\n${Object.keys(medida).length} memoriais, ${mudancas} campo(s) mudaram`);
} else if (!salvar) {
  console.log(JSON.stringify(medida, null, 1));
} else {
  console.log(`${Object.keys(medida).length} memoriais medidos → ${salvar}`);
}
