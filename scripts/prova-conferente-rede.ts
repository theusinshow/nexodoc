/**
 * A REDE DE ARRASTO CONTRA BLOCOS REAIS — Encaixe 2.
 *
 *   npm run prova:conferente-rede
 *
 * O QUE ESTA PROVA MEDE
 *
 * A rede varre os blocos que o modelo grande não leu. O risco dela tem dois
 * lados, e os dois estão aqui:
 *
 *  - CALAR onde há defeito. A rede existe para isso; se ela não acusa o bloco
 *    da página 34 do 129-24, que tem "Fck=30Mpa ou 300kg/metro quadrado"
 *    escrito, ela não serve para nada.
 *  - TAGARELAR onde não há. Achado de rede não tem trecho exato — o engenheiro
 *    precisa abrir o bloco para conferir. Uma rede que acusa todo bloco faz ele
 *    parar de abrir, e aí ela também não serve para nada.
 *
 * Os blocos são recortados do PDF REAL, não escritos por mim. O gabarito vem de
 * eu ter conferido esses defeitos contra o texto extraído em 21/09/2026.
 *
 * Custa ~6 chamadas de bloco (7k tokens de entrada cada); saída de graça.
 * Cerca de US$ 0,002 a corrida.
 *
 * MEDIDO em 21/09/2026, e com um limite que fica escrito porque é real:
 *
 *   129-24 p.30-37 (15.938 chars)  -> wrong_unit, e só
 *   025-24 p.107                   -> other_project_residue
 *   025-24 p.17-19                 -> road_language, unlisted_reference
 *   129-24 p.22                    -> road_language, unlisted_reference
 *   129-24 p.5-8 (bloco limpo)     -> NADA
 *
 * O QUE ELA NÃO PEGOU: o `arithmetic_mismatch` do 025-24, no bloco p.17-19 que
 * tem o total de aterro (1.673) E as três parcelas (385, 364, 648) escritas
 * dentro dele. Um sim/não sobre 5.216 caracteres não soma três números. Isso
 * não é defeito da rede: é a fronteira dela. Conta que não fecha é trabalho de
 * REGRA determinística, e é assim que o motor já a pega — `runFireLoadArithmeticRule`
 * e `runDeclaredTotalAreaRule` existem por isso. A pergunta continua na lista
 * porque pega o caso fácil (total e parcelas na mesma linha), mas ninguém deve
 * contar com ela para aritmética.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

import { conferenteEstaConfigurado } from "../lib/conferente/jev.ts";
import { varrerBloco } from "../lib/conferente/encaixe-2-rede.ts";
import { chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";

const PASTA = "C:/Users/matheus.mendes/Desktop/NexoDoc/NEXO - TESTES/Memoriais";

type Alvo = {
  rotulo: string;
  arquivo: string;
  /** A página cujo bloco será varrido. */
  pagina: number;
  /** As chaves de defeito que a rede TEM de acusar. */
  esperados: string[];
  /** Teto de achados: acima disto ela está tagarelando. */
  teto: number;
};

const ALVOS: Alvo[] = [
  {
    rotulo: '129-24 p.34 · "Fck=30Mpa ou 300kg/metro quadrado"',
    arquivo: "129_24_md_geral_a.pdf",
    pagina: 34,
    esperados: ["wrong_unit"],
    teto: 4,
  },
  {
    rotulo: '025-24 p.107 · "todas as escadas da escola" numa orla',
    arquivo: "025_24_md_geral_a.pdf",
    pagina: 107,
    esperados: ["other_project_residue"],
    teto: 4,
  },
  {
    rotulo: "025-24 p.18 · aterro 1.673 que não fecha + eixo da rodovia",
    arquivo: "025_24_md_geral_a.pdf",
    pagina: 18,
    esperados: ["road_language"],
    teto: 5,
  },
  {
    rotulo: "129-24 p.22 · remissão ao Volume 2 nunca listado",
    arquivo: "129_24_md_geral_a.pdf",
    pagina: 22,
    esperados: ["unlisted_reference"],
    teto: 5,
  },
  {
    rotulo: "129-24 p.6-7 · apresentação da obra (bloco limpo)",
    arquivo: "129_24_md_geral_a.pdf",
    pagina: 7,
    esperados: [],
    teto: 2,
  },
];

function chaveDoAchado(tipo: string) {
  if (tipo.includes("Unidade")) return "wrong_unit";
  if (tipo.includes("Resíduo de outro projeto")) return "other_project_residue";
  if (tipo.includes("rodoviário")) return "road_language";
  if (tipo.includes("Contradição")) return "contradiction";
  if (tipo.includes("peça não declarada")) return "unlisted_reference";
  if (tipo.includes("não fecha")) return "arithmetic_mismatch";
  if (tipo.includes("modelo não preenchido")) return "template_placeholder";
  if (tipo.includes("Norma")) return "superseded_standard";
  return tipo;
}

async function main() {
  if (!conferenteEstaConfigurado()) {
    console.log("JEV_API_KEY não configurada — prova pulada (e a auditoria roda sem a rede).");
    return;
  }

  const erros: string[] = [];
  const cache = new Map<string, ReturnType<typeof chunkPdfByChapter>>();

  for (const alvo of ALVOS) {
    if (!cache.has(alvo.arquivo)) {
      const extraido = await extractPdfText(fs.readFileSync(`${PASTA}/${alvo.arquivo}`));
      cache.set(alvo.arquivo, chunkPdfByChapter(extraido));
    }

    const blocos = cache.get(alvo.arquivo)!;
    const bloco = blocos.find((item) => alvo.pagina >= item.startPage && alvo.pagina <= item.endPage);

    if (!bloco) {
      erros.push(`${alvo.rotulo}: não achei o bloco da página ${alvo.pagina}`);
      continue;
    }

    const achados = await varrerBloco(bloco, alvo.arquivo);
    const chaves = achados.map((achado) => chaveDoAchado(achado.tipo));

    console.log(
      `\n  ${alvo.rotulo}\n     bloco "${bloco.title}" págs. ${bloco.startPage}-${bloco.endPage}, ${bloco.text.length} chars` +
        `\n     acusou: ${chaves.length > 0 ? chaves.join(", ") : "(nada)"}`,
    );

    for (const esperado of alvo.esperados) {
      if (!chaves.includes(esperado)) {
        erros.push(`${alvo.rotulo}: a rede NÃO acusou "${esperado}", que está no texto`);
      }
    }

    if (chaves.length > alvo.teto) {
      erros.push(
        `${alvo.rotulo}: a rede acusou ${chaves.length} defeitos (teto ${alvo.teto}) — está tagarelando`,
      );
    }
  }

  console.log("");
  assert.equal(erros.length, 0, `a rede errou em:\n  ${erros.join("\n  ")}`);
  console.log("ok  a rede acha o defeito no bloco real e nao tagarela no bloco limpo");
}

await main();
