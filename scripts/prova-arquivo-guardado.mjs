// O ARQUIVO GUARDADO, provado contra o banco.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-arquivo-guardado.mjs
//   (== npm run prova:arquivo)
//
// Três perguntas que só o banco responde:
//   1. gravar o mesmo conteúdo duas vezes duplica?
//   2. arquivo grande demais é recusado COM MOTIVO, ou estoura mais fundo?
//   3. os bytes voltam byte a byte?
//
// SEM IA e SEM NAVEGADOR.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo, ArquivoRecusado, LIMITE_DO_ARQUIVO } = await import(
  "../lib/file-storage.ts"
);

const prisma = getPrisma();
const ORG = "org-prosul";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const conteudo = Buffer.from("%PDF-1.7 memorial de prova\n".repeat(500), "utf8");

// 1. Grava.
const primeiro = await guardarArquivo({
  data: conteudo,
  organizationId: ORG,
  mimeType: "application/pdf",
});
check("gravou e devolveu o checksum", /^[a-f0-9]{64}$/.test(primeiro.checksumSha256));
check("o tamanho confere", primeiro.sizeBytes === conteudo.byteLength);

// 2. Grava o MESMO conteúdo de novo.
const segundo = await guardarArquivo({
  data: conteudo,
  organizationId: ORG,
  mimeType: "application/pdf",
});
check(
  "o mesmo conteúdo dá o MESMO checksum",
  segundo.checksumSha256 === primeiro.checksumSha256,
);

const quantos = await prisma.storedFile.count({
  where: { checksumSha256: primeiro.checksumSha256 },
});
check("gravar duas vezes NÃO duplica", quantos === 1, `achei ${quantos}`);

// 3. Os bytes voltam iguais.
const lido = await prisma.storedFile.findUniqueOrThrow({
  where: { checksumSha256: primeiro.checksumSha256 },
  select: { bytes: true, mimeType: true, organizationId: true },
});
check("os bytes voltam byte a byte", Buffer.from(lido.bytes).equals(conteudo));
check(
  "o mime e o escritório vieram junto",
  lido.mimeType === "application/pdf" && lido.organizationId === ORG,
);

// 4. Grande demais é RECUSADO com motivo.
let recusa = null;
try {
  await guardarArquivo({
    data: Buffer.alloc(LIMITE_DO_ARQUIVO + 1),
    organizationId: ORG,
    mimeType: "application/pdf",
  });
} catch (err) {
  recusa = err;
}
check("arquivo acima do teto é recusado", recusa instanceof ArquivoRecusado);
check(
  "e a recusa DIZ o porquê, com os dois números",
  Boolean(recusa?.motivo?.includes("MB")),
  recusa?.motivo,
);

await prisma.storedFile.deleteMany({ where: { checksumSha256: primeiro.checksumSha256 } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
