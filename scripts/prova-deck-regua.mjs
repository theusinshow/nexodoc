// O TRILHO ACENDE A FOLHA CERTA — 10/09/2026.
//
// Em cada folha do deck e do anexo: o índice aceso no trilho é o número da
// folha, e o nome do bloco na vertical é o bloco dela. É a prova de que a
// armadura (que vive fora da folha) e o conteúdo (que vive dentro) não se
// desencontram — o único jeito de isso quebrar é silencioso.
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-deck-regua.mjs
//
// NÃO GASTA TOKEN.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const BLOCOS_DO_DECK = [
  "",
  "O que é",
  "O que é",
  "O que é",
  "O que é",
  "O problema",
  "O problema",
  "O problema",
  "O que existe",
  "O que existe",
  "O que existe",
  "O dinheiro",
  "Possíveis perguntas",
  "Possíveis perguntas",
  "Possíveis perguntas",
  "Possíveis perguntas",
  "O dinheiro",
  "O pedido",
  "O pedido",
];
const LETRAS = ["A", "B", "C", "D", "E", "F"];

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

async function trilho() {
  return p.evaluate(() => {
    const t = document.querySelector(".ap-trilho");
    if (!t) return null;
    const aceso = t.querySelector(".ap-trilho__indice--atual");
    const marca = t.querySelector(".ap-trilho__marca");
    const r = aceso?.getBoundingClientRect();
    const m = marca?.getBoundingClientRect();
    return {
      indices: t.querySelectorAll(".ap-trilho__indice").length,
      aceso: aceso?.textContent?.trim() ?? null,
      bloco: t.querySelector(".ap-trilho__bloco")?.textContent?.trim() ?? "",
      // a marca fica na mesma altura do índice aceso (centro a centro, ±2 px)
      marcaAlinhada:
        r && m
          ? Math.abs(r.top + r.height / 2 - (m.top + m.height / 2)) < 2
          : false,
    };
  });
}

for (const [rota, esperados, blocos] of [
  [
    "/apresentacao",
    Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")),
    BLOCOS_DO_DECK,
  ],
  ["/apresentacao/valores", LETRAS, LETRAS.map(() => "Os valores")],
]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  for (let i = 0; i < esperados.length; i++) {
    if (i > 0) {
      await p.keyboard.press("ArrowRight");
      await p.waitForTimeout(350);
    }
    const t = await trilho();
    ok(`${rota} ${esperados[i]} tem trilho`, !!t);
    if (!t) continue;
    ok(
      `${rota} ${esperados[i]} lista ${esperados.length} índices`,
      t.indices === esperados.length,
      String(t.indices),
    );
    ok(
      `${rota} ${esperados[i]} acende o índice certo`,
      t.aceso === esperados[i],
      t.aceso ?? "nenhum",
    );
    ok(
      `${rota} ${esperados[i]} mostra o bloco certo`,
      t.bloco === blocos[i],
      JSON.stringify(t.bloco),
    );
    ok(`${rota} ${esperados[i]} marca alinhada ao índice`, t.marcaAlinhada);
  }
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO CERTO");
process.exit(falhas ? 1 : 0);
