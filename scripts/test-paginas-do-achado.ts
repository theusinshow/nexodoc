// Onde o achado aparece — todas as páginas, e não só a primeira.
//
//   node scripts/test-paginas-do-achado.ts   (== npm run test:paginas)
//
// O caso que dá o desenho é o do MEIO: a referência é prosa livre, e varrer
// número solto dali encheria a fita de páginas que não existem. Uma fita errada
// é pior que fita nenhuma — cada número dela é um link, e link errado leva a
// pessoa para a página errada com a confiança de quem seguiu a ferramenta.
import { ehMultiPagina, paginasDoAchado, rotuloDePaginas } from "../lib/paginas-do-achado.ts";

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const igual = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// --- O caso que motivou tudo: a tela dizia "página 8" e calava sobre as outras.
const cruzado = paginasDoAchado({
  pagina: "8",
  referencia: "Identidade predominante inferida: m² (7 ocorrência(s), páginas 8, 60, 71, 105).",
});
check("as paginas cruzadas saem da referencia", igual(cruzado, [8, 60, 71, 105]), cruzado.join(","));
check("e a principal continua sendo a do campo pagina", cruzado[0] === 8, `${cruzado[0]}`);
check("o rotulo vira '4 paginas'", rotuloDePaginas(cruzado) === "4 páginas", rotuloDePaginas(cruzado));
check("e ele conta como multi-pagina", ehMultiPagina(cruzado));

// --- O 7 de "7 ocorrências" NÃO é página. É o número que vem antes da palavra,
//     e é por isso que o recorte começa em "páginas" e não no início da frase.
check("o numero de ocorrencias nao vira pagina", !cruzado.includes(7), cruzado.join(","));

// --- Referência que não fala de página não entra NADA.
const semPagina = paginasDoAchado({
  pagina: "12",
  referencia: "Itens identificados: 2.1, 3.4, 7.9. Capítulo esperado: 4.",
});
check("referencia sem 'pagina' nao contribui", igual(semPagina, [12]), semPagina.join(","));

// --- Um achado de um lugar só não muda em nada.
const simples = paginasDoAchado({ pagina: "84", referencia: "Objeto principal inferido do documento." });
check("achado de uma pagina fica com uma", igual(simples, [84]), simples.join(","));
check("e o rotulo continua 'pagina 84'", rotuloDePaginas(simples) === "página 84", rotuloDePaginas(simples));
check("e ele NAO e multi-pagina", !ehMultiPagina(simples));

// --- Intervalo vira as páginas do intervalo.
const intervalo = paginasDoAchado({ pagina: "12-15" });
check("intervalo vira as paginas dele", igual(intervalo, [12, 13, 14, 15]), intervalo.join(","));

// --- Intervalo absurdo NÃO vira 1200 páginas: é numeração de item ou faixa de
//     norma, e explodir isso encheria a fita e a memória.
const absurdo = paginasDoAchado({ pagina: "1-1200" });
check("intervalo absurdo nao explode", absurdo.length <= 2, `${absurdo.length} paginas`);

// --- Página ausente não inventa nada.
const vazio = paginasDoAchado({ pagina: "", referencia: "" });
check("sem pagina, lista vazia", vazio.length === 0, vazio.join(","));
check(
  "e o rotulo cai no texto cru, sem inventar numero",
  rotuloDePaginas(vazio, "não informada") === "não informada",
  rotuloDePaginas(vazio, "não informada"),
);

// --- Repetida entre os dois campos aparece uma vez só.
const repetida = paginasDoAchado({ pagina: "8", referencia: "ocorrências nas páginas 8, 8, 60." });
check("pagina repetida aparece uma vez", igual(repetida, [8, 60]), repetida.join(","));

// --- Ano não é página: "2026" passa do teto e sai.
const comAno = paginasDoAchado({ pagina: "9", referencia: "páginas 9 e 3000." });
check("numero fora do teto de paginas sai", igual(comAno, [9]), comAno.join(","));

if (falhas > 0) {
  console.error(`\nFALHOU  paginas do achado (${falhas})`);
  process.exit(1);
}

console.log("\nOK  paginas do achado");
