/**
 * QUANTAS VEZES OS FRAMES FURAM A `DESIGN.md`.
 *
 *   node scripts/mede-divida-de-design.ts   (== npm run mede:divida)
 *
 * "Apertado, pequeno e muito junto" não é questão de gosto: é a escala do
 * sistema sendo ignorada. Este script transforma a reclamação em número, e o
 * número em portão — ele sai com código 1 enquanto houver violação, então a
 * dívida não volta pela porta dos fundos numa tela nova copiada daqui.
 *
 * As três regras vêm da `DESIGN.md`, palavra por palavra:
 *
 *   tipografia  "a rampa não tem buracos… para que nenhuma tela invente um
 *                tamanho fora da escala (`text-[11px]`, `text-[15px]`)"
 *               "microrrótulos podem cair a 11px, NUNCA ABAIXO"
 *   grade       "Grade base de 4px; todo espaçamento é múltiplo de 4"
 *
 * O 11px NÃO é proibido — ele é um degrau real da escala. O que é proibido é
 * ele aparecer como valor solto: nomeado (`text-microrrotulo`) ele é escala e
 * dá para achar todos os usos; escrito à mão dezoito vezes, é invenção mesmo
 * quando o número coincide.
 */
import { readFileSync } from "node:fs";

const ARQUIVOS = [
  "modules/nexo/components/FrameDoDocumento.tsx",
  "modules/nexo/components/PlanoDeGeracao.tsx",
  "modules/nexo/components/BlocoDaLd.tsx",
  "modules/nexo/components/EditorDoNo.tsx",
  "modules/nexo/components/ConfirmationCard.tsx",
];

/** Tamanho de fonte escrito à mão. Qualquer um: a escala tem degrau nomeado. */
const FONTE_INVENTADA = /text-\[(\d+(?:\.\d+)?)px\]/g;

/** `0.5`=2px, `1.5`=6px, `2.5`=10px, `3.5`=14px — nenhum é múltiplo de 4. */
const FORA_DA_GRADE =
  /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|space-x|space-y)-(?:0\.5|1\.5|2\.5|3\.5)\b/g;

interface Achado {
  arquivo: string;
  linha: number;
  regra: string;
  trecho: string;
}

const achados: Achado[] = [];

for (const arquivo of ARQUIVOS) {
  const linhas = readFileSync(arquivo, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    /*
     * Comentário não é interface. Estes arquivos explicam o PORQUÊ das
     * decisões, e um comentário que cita `text-[10px]` para contar que ele saiu
     * seria lido como violação — o contador acusaria a própria explicação.
     */
    if (/^\s*(\*|\/\/|\/\*)/.test(linha)) return;
    const codigo = linha.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const m of codigo.matchAll(FONTE_INVENTADA)) {
      const px = Number(m[1]);
      achados.push({
        arquivo,
        linha: i + 1,
        regra: px < 11 ? `${px}px — abaixo do piso de 11px` : "tamanho solto, use o degrau nomeado",
        trecho: m[0],
      });
    }
    for (const m of codigo.matchAll(FORA_DA_GRADE)) {
      achados.push({ arquivo, linha: i + 1, regra: "fora da grade de 4px", trecho: m[0] });
    }
  });
}

const curto = (a: string) => a.replace("modules/nexo/components/", "");
const porArquivo = new Map<string, number>();
for (const a of achados) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);

console.log("dívida de design nos frames editáveis\n");
for (const arquivo of ARQUIVOS) {
  console.log(`  ${String(porArquivo.get(arquivo) ?? 0).padStart(3)}  ${curto(arquivo)}`);
}
console.log(`\n  ${achados.length} violação(ões)`);

if (achados.length > 0) {
  console.log("\ndetalhe:");
  for (const a of achados) {
    console.log(`  ${curto(a.arquivo)}:${a.linha}  ${a.trecho.padEnd(16)} — ${a.regra}`);
  }
  process.exit(1);
}
console.log("\nnenhuma. os frames estão na escala.");
