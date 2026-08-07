// A TELA QUE NINGUÉM CONSEGUE ABRIR — e que é o software inteiro para quem cai
// nela.
//
// `/sem-acesso` devolve para `/nexo` quem já está liberado, e quem programa
// está sempre liberado. Produzir a sessão válida-porém-bloqueada exigiria mexer
// no banco. A vista mora separada (`app/sem-acesso/aviso-sem-acesso.tsx`)
// justamente para poder ser conferida sem isso — este script monta a vista numa
// ROTA TEMPORÁRIA, fotografa e apaga a rota.
//
// A rota nasce e morre dentro deste script, inclusive se ele quebrar no meio.
//
//   npm run dev                       (noutro terminal)
//   node scripts/shot-sem-acesso.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/telas";
fs.mkdirSync(OUT, { recursive: true });

const PASTA = path.resolve("app/previa-sem-acesso-temporaria");
const ROTA = path.join(PASTA, "page.tsx");

const CONTEUDO = `import { AvisoSemAcesso } from "../sem-acesso/aviso-sem-acesso";

// GERADO POR scripts/shot-sem-acesso.mjs — apagado por ele no fim.
export default function PreviaSemAcesso() {
  return (
    <AvisoSemAcesso
      email="engenheiro@prosul.com.br"
      admins={["matheusmendes077@gmail.com"]}
    />
  );
}
`;

function limpar() {
  fs.rmSync(PASTA, { recursive: true, force: true });
}

process.on("exit", limpar);
process.on("SIGINT", () => {
  limpar();
  process.exit(130);
});

fs.mkdirSync(PASTA, { recursive: true });
fs.writeFileSync(ROTA, CONTEUDO, "utf8");

const browser = await chromium.launch();

try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  // O dev server precisa notar o arquivo novo e compilá-lo sob demanda.
  await page.goto(`${BASE}/previa-sem-acesso-temporaria`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.getByText(/libera|acesso/i).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(900);

  const arquivo = path.join(OUT, "19-sem-acesso.png");
  await page.screenshot({ path: arquivo });
  console.log(`  19  sem-acesso  (${Math.round(fs.statSync(arquivo).size / 1024)} KB)`);

  // Sem ninguém declarado como admin: o texto muda, e é o pior caso.
  fs.writeFileSync(
    ROTA,
    CONTEUDO.replace('admins={["matheusmendes077@gmail.com"]}', "admins={[]}"),
    "utf8",
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const arquivo2 = path.join(OUT, "20-sem-acesso-sem-admin.png");
  await page.screenshot({ path: arquivo2 });
  console.log(`  20  sem-acesso-sem-admin  (${Math.round(fs.statSync(arquivo2).size / 1024)} KB)`);
} finally {
  await browser.close();
  limpar();
  console.log(`\n  rota temporária removida: ${fs.existsSync(PASTA) ? "NÃO" : "sim"}`);
}
