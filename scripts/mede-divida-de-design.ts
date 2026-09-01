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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * DOIS ALCANCES, e a diferença é deliberada.
 *
 * A regra de COR olha a UI inteira: hex cru num frame não é mais nem menos
 * dívida que hex cru num botão.
 *
 * As regras de ESCALA (tipografia e grade de 4px) continuam nos cinco frames
 * editáveis para os quais foram escritas. Ampliá-las junto com a cor levantou
 * **403 violações de espaçamento** numa medição de 01/09/2026 — dívida real, e
 * de outra frente. Corrigi-las de carona numa varredura de contraste seria uma
 * refatoração enorme que ninguém pediu; e deixá-las acusando sem corrigir
 * transformaria este portão num alarme que se aprende a ignorar.
 *
 * Ampliar o alcance da escala é decisão a tomar de propósito, com o número na
 * mão. O número está aqui.
 */
const RAIZES_DE_COR = ["components", "modules/nexo/components"];

/** Os frames para os quais as regras de escala foram escritas. */
const FRAMES_EDITAVEIS = [
  "modules/nexo/components/FrameDoDocumento.tsx",
  "modules/nexo/components/PlanoDeGeracao.tsx",
  "modules/nexo/components/BlocoDaLd.tsx",
  "modules/nexo/components/EditorDoNo.tsx",
  "modules/nexo/components/ConfirmationCard.tsx",
];

/**
 * ONDE NÃO OLHAR — e cada exclusão tem motivo, não conveniência.
 *
 *   brand/       a marca. Cor ali é a identidade, não estilo. Um token no lugar
 *                do hex do logotipo trocaria a marca por uma variável de tema.
 *   agent-orb/   WebGL. Cor é DADO que vai para o shader, não classe de CSS.
 *   bancada-     bancadas de afinação. Elas existem para experimentar valor cru;
 *                um fiscal ali proibiria exatamente o que a tela é.
 *
 * Acrescentar exclusão exige escrever o motivo AQUI. Sem isso, a lista vira o
 * lugar onde a regra é afrouxada em silêncio.
 */
const FORA = ["/brand/", "/agent-orb/", "/bancada-"];

function arquivosDeUi(raiz: string, achados: string[] = []): string[] {
  for (const item of readdirSync(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, item.name).replace(/\\/g, "/");
    if (item.isDirectory()) arquivosDeUi(caminho, achados);
    else if (caminho.endsWith(".tsx") && !FORA.some((f) => caminho.includes(f))) {
      achados.push(caminho);
    }
  }
  return achados;
}

const ARQUIVOS = RAIZES_DE_COR.flatMap((r) => arquivosDeUi(r)).sort();

/** Tamanho de fonte escrito à mão. Qualquer um: a escala tem degrau nomeado. */
const FONTE_INVENTADA = /text-\[(\d+(?:\.\d+)?)px\]/g;

/**
 * Cor escrita à mão. O sistema tem token para tudo que é vocabulário
 * (`DESIGN.md` §2), e um hex solto é uma cor que não passou pelo portão do §12 —
 * não tem nome, não tem trabalho declarado, e não aparece em nenhuma busca por
 * onde aquela cor é usada.
 */
const COR_CRUA = /#[0-9a-fA-F]{3,8}\b/g;

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

    /* A escala só vale nos frames — ver o comentário de RAIZES_DE_COR. */
    const naEscala = FRAMES_EDITAVEIS.includes(arquivo);

    for (const m of naEscala ? codigo.matchAll(FONTE_INVENTADA) : []) {
      const px = Number(m[1]);
      achados.push({
        arquivo,
        linha: i + 1,
        regra: px < 11 ? `${px}px — abaixo do piso de 11px` : "tamanho solto, use o degrau nomeado",
        trecho: m[0],
      });
    }
    for (const m of naEscala ? codigo.matchAll(FORA_DA_GRADE) : []) {
      achados.push({ arquivo, linha: i + 1, regra: "fora da grade de 4px", trecho: m[0] });
    }
    for (const m of codigo.matchAll(COR_CRUA)) {
      achados.push({ arquivo, linha: i + 1, regra: "cor crua, use o token", trecho: m[0] });
    }
  });
}

const curto = (a: string) =>
  a.replace("modules/nexo/components/", "").replace("components/", "");
const porArquivo = new Map<string, number>();
for (const a of achados) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);

console.log(
  `dívida de design: cor em ${ARQUIVOS.length} arquivos de UI, ` +
    `escala nos ${FRAMES_EDITAVEIS.length} frames editáveis\n`,
);

/* SÓ QUEM TEM DÍVIDA. Listar os limpos gastaria a tela com o que está certo, e é
 * a lista de pendências que precisa caber de uma olhada. */
const comDivida = [...porArquivo.entries()].sort((a, b) => b[1] - a[1]);
for (const [arquivo, quantas] of comDivida) {
  console.log(`  ${String(quantas).padStart(3)}  ${curto(arquivo)}`);
}
console.log(`\n  ${achados.length} violação(ões) em ${comDivida.length} arquivo(s)`);

if (achados.length > 0) {
  console.log("\ndetalhe:");
  for (const a of achados) {
    console.log(`  ${curto(a.arquivo)}:${a.linha}  ${a.trecho.padEnd(16)} — ${a.regra}`);
  }
  process.exit(1);
}
console.log("\nnenhuma. os frames estão na escala.");
