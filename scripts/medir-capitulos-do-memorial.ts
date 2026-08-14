/**
 * O fatiamento por capítulo se sustenta NOS MEMORIAIS REAIS?
 *
 * O comparativo por capítulo só serve se o documento se dividir em pedaços
 * reconhecíveis. Se um memorial vira três blocos de 28 mil caracteres sem
 * título nenhum (o corte por tamanho, não por capítulo), então "reauditar só o
 * que mudou" reenviaria quase tudo — e a etapa 2 precisa de outro fatiador
 * antes de existir.
 *
 * Não gasta token: só lê o PDF e conta.
 *
 *   node scripts/medir-capitulos-do-memorial.ts [caminho.pdf ...]
 */
import fs from "node:fs";
import path from "node:path";

import { chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";
import { impressaoDosCapitulos } from "../lib/audit-fingerprint.ts";

const PASTA = "C:\\Users\\matheus.mendes\\Desktop\\NexoDoc\\NEXO - TESTES\\Memoriais";
const alvos =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : fs.existsSync(PASTA)
      ? fs
          .readdirSync(PASTA)
          .filter((f) => f.toLowerCase().endsWith(".pdf"))
          .map((f) => path.join(PASTA, f))
      : [];

if (alvos.length === 0) {
  console.error("Nenhum PDF. Passe caminhos ou aponte a pasta de memoriais.");
  process.exit(1);
}

for (const alvo of alvos) {
  const extraido = await extractPdfText(fs.readFileSync(alvo));
  const capitulos = impressaoDosCapitulos(chunkPdfByChapter(extraido));
  const comTitulo = capitulos.filter((c) => c.titulo.trim().length > 0);
  const maior = Math.max(...capitulos.map((c) => c.chars));
  const mediana = [...capitulos.map((c) => c.chars)].sort((a, b) => a - b)[
    Math.floor(capitulos.length / 2)
  ];
  console.log(`\n${path.basename(alvo)}`);
  console.log(
    `  ${extraido.pageCount} páginas · ${extraido.charCount.toLocaleString("pt-BR")} chars`,
  );
  console.log(
    `  ${capitulos.length} capítulo(s), ${comTitulo.length} com título detectado`,
  );
  console.log(
    `  maior ${maior.toLocaleString("pt-BR")} chars · mediano ${mediana?.toLocaleString("pt-BR")} chars`,
  );
  for (const c of capitulos.slice(0, 12)) {
    console.log(
      `    p.${String(c.startPage).padStart(3)}–${String(c.endPage).padEnd(3)} ${String(c.chars).padStart(6)}  ${c.titulo || "(sem título)"}`,
    );
  }
  if (capitulos.length > 12) console.log(`    … +${capitulos.length - 12}`);
  /*
   * O VEREDITO desta medição: qual fração do documento poderia ser poupada se
   * UM capítulo fosse reescrito. Capítulo gigante = pouca economia possível.
   */
  const total = capitulos.reduce((n, c) => n + c.chars, 0);
  console.log(
    `  se o MAIOR capítulo mudasse, dava para poupar ${Math.round(((total - maior) / total) * 100)}% do texto`,
  );
}
