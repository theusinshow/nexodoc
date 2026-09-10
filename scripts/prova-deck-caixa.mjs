// A REGRA DA CAIXA ALTA, medida — 10/09/2026.
//
// Caixa alta em três lugares e só neles: rótulo-título, rótulos Mono e siglas.
// Os dois primeiros são feitos por CSS (`text-transform`), então o DOM guarda
// caixa de frase — e é o DOM que se lê aqui. Uma palavra de 4+ letras toda em
// caixa alta, fora de elemento Mono e fora da lista de siglas, é caixa alta
// digitada onde não devia. Uma sigla da lista em minúscula é o defeito que o
// autor apontou em 10/09 ("palavras que tinham de estar em caixa alta e não
// estão").
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-deck-caixa.mjs
//
// NÃO GASTA TOKEN.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SIGLAS = [
  "LD",
  "LDS",
  "UBS",
  "ODT",
  "PDF",
  "ZIP",
  "IA",
  "PROSUL",
  "API",
  "OCR",
  "SC",
  "S/N",
  "EST",
];
// "ia" e "sc" em minúscula são palavras da língua ("ele ia"): só as inequívocas.
// Extensão de arquivo (".pdf" em "117_25_md_geral_a.pdf") é minúscula por direito.
const MINUSCULAS_PROIBIDAS = /(?<![.\w])(ld|lds|ubs|odt|pdf|zip|prosul|api|ocr)\b/;

const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width: 1600, height: 1000 },
  reducedMotion: "reduce",
});
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(
    (cond ? "  OK      " : "  FALHOU  ") + nome + (cond ? "" : " :: " + detalhe),
  );
  if (!cond) falhas++;
};
await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}

for (const [rota, n] of [
  ["/apresentacao", 19],
  ["/apresentacao/valores", 6],
]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  for (let i = 1; i <= n; i++) {
    if (i > 1) {
      await p.keyboard.press("ArrowRight");
      await p.waitForTimeout(350);
    }
    const r = await p.evaluate((siglas) => {
      const folha = document.querySelector(".ap-folha:not(.ap-folha--sai)");
      const andar = document.createTreeWalker(folha, NodeFilter.SHOW_TEXT);
      const capsForaDoMono = [];
      let texto = "";
      let no;
      while ((no = andar.nextNode())) {
        const t = no.textContent;
        texto += " " + t;
        const el = no.parentElement;
        const mono = /Mono|monospace/i.test(getComputedStyle(el).fontFamily);
        if (mono) continue;
        for (const palavra of t.split(/[^\p{L}/]+/u)) {
          if (
            palavra.length >= 4 &&
            palavra === palavra.toUpperCase() &&
            palavra !== palavra.toLowerCase() &&
            !siglas.includes(palavra)
          ) {
            capsForaDoMono.push(palavra);
          }
        }
      }
      return {
        capsForaDoMono,
        texto,
        rotulos: folha.querySelectorAll(".ap-rotulo-titulo").length,
      };
    }, SIGLAS);
    const numero = String(i).padStart(2, "0");
    const min = r.texto.match(MINUSCULAS_PROIBIDAS);
    ok(`${rota} ${numero} sem sigla em minúscula`, !min, min?.[0] ?? "");
    ok(
      `${rota} ${numero} sem caixa alta digitada fora do Mono`,
      r.capsForaDoMono.length === 0,
      r.capsForaDoMono.join(", "),
    );
    if (!(rota === "/apresentacao" && i === 1)) {
      ok(`${rota} ${numero} tem rótulo-título`, r.rotulos === 1, String(r.rotulos));
    }
  }
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO CERTO");
process.exit(falhas ? 1 : 0);
