// UM RETRATO DE CADA TELA QUE O USUÁRIO ALCANÇA.
//
// Não é portão de qualidade: nenhuma asserção, nenhum veredito. É material para
// olhar — o que este projeto aprendeu a fazer antes de discutir desenho, porque
// asserção de DOM já passou verde com painel fora da tela.
//
// NÃO GASTA TOKEN. O estado rico vem do PROJETO DE EXEMPLO que o tour guiado já
// semeia (`modules/nexo/lib/projeto-exemplo.ts`): selo lido, documento gerado e
// parecer com achados, tudo escrito à mão. Andar o tour é, de graça, a única
// forma de ver o palco cheio sem processar um volume de verdade.
//
//   npm run dev                             (noutro terminal)
//   node scripts/shot-telas-do-produto.mjs
//
// Sai em ./scratchpad/telas/ com nome numerado na ordem em que o usuário vê.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/telas";
const LARGURA = Number(process.env.SHOT_W ?? 1600);
const ALTURA = Number(process.env.SHOT_H ?? 1000);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
const feitos = [];

async function retrato(page, nome, { esperar = 700 } = {}) {
  n += 1;
  const arquivo = path.join(OUT, `${String(n).padStart(2, "0")}-${nome}.png`);
  await page.waitForTimeout(esperar);
  await page.screenshot({ path: arquivo });
  const kb = Math.round(fs.statSync(arquivo).size / 1024);
  console.log(`  ${String(n).padStart(2, "0")}  ${nome}  (${kb} KB)`);
  feitos.push({ nome, arquivo });
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- os portões
{
  const ctx = await browser.newContext({ viewport: { width: LARGURA, height: ALTURA } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await retrato(page, "login");

  // O erro do Google tem tratamento próprio na tela, e ninguém nunca o viu.
  await page.goto(`${BASE}/login?error=OAuthCallback`, { waitUntil: "networkidle" });
  await retrato(page, "login-com-erro");

  await ctx.close();
}

// ------------------------------------------------ entrar e ver o que vem antes
const ctx = await browser.newContext({ viewport: { width: LARGURA, height: ALTURA } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Entrar como dev/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

// Onde o login CAI. Não é o chat: há uma tela entre o portão e o produto.
//
// O `networkidle` não basta aqui: no dev server a primeira visita compila sob
// demanda, e a foto saía preta com o selo "Rendering..." no canto. Esperar por
// TEXTO é o que garante que há tela para fotografar.
await page.waitForLoadState("networkidle");
await page.locator("h1, h2, main a, main button").first().waitFor({ timeout: 60_000 });
await retrato(page, "pos-login-para-onde-cai", { esperar: 1500 });

/*
 * `/sem-acesso` NÃO é alcançável por navegação: a página devolve para `/nexo`
 * quem já está liberado, e o usuário de dev está. Inventar uma sessão
 * válida-porém-bloqueada exigiria mexer no banco.
 *
 * A vista mora separada (`AvisoSemAcesso`) exatamente para poder ser
 * conferida sem isso — e é o que `shot-sem-acesso.mjs` faz, montando a vista
 * numa rota temporária. Aqui só registro a ausência, para o vazio não passar
 * por "não existe tela".
 */
console.log("     (sem-acesso: fora daqui, ver shot-sem-acesso.mjs)");

// -------------------------------------------------------- Nexo: primeira vez
// Sem pular o tour: primeiro acesso É um estado da tela, e é o que todo
// testador vai ver.
await page.goto(`${BASE}/nexo`, { waitUntil: "networkidle" });
await retrato(page, "nexo-primeiro-acesso", { esperar: 2500 });

// --------------------------------------------------------------- o tour todo
// Cada passo do tour para num lugar diferente do produto: o orbe, o composer, a
// resposta com os selos, o palco com o mapa do volume, o parecer, o pin sobre o
// documento, a pilha de recorrentes. É o passeio mais barato pelo produto cheio.
const PASSOS = [
  "tour-abertura",
  "tour-orbe",
  "tour-composer",
  "tour-selo-lido",
  "tour-mapa-do-volume",
  "tour-auditoria-parecer",
  "tour-veredito",
  "tour-no-documento",
  "tour-pilha-recorrente",
  "tour-parecer-completo",
  "tour-fecho",
];

let passo = 0;
for (const nome of PASSOS) {
  await retrato(page, nome, { esperar: 1200 });
  passo += 1;

  const proximo = page
    .getByRole("button", { name: /Pr[oó]ximo|Come[cç]ar|Entendi|Concluir|Fechar/i })
    .first();

  if ((await proximo.count()) === 0) {
    console.log(`     (o tour acabou no passo ${passo}, sem botão de avançar)`);
    break;
  }

  try {
    await proximo.click({ timeout: 4000 });
  } catch {
    console.log(`     (não consegui avançar do passo ${passo})`);
    break;
  }
}

// ------------------------------------------------- Nexo vazio, depois do tour
await page.goto(`${BASE}/nexo`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await retrato(page, "nexo-boas-vindas-limpo");

// A entrada em janela estreita. Coluna de 240px + palco + copiloto de 520px não
// cabe em qualquer tela, e nunca ninguém olhou o que acontece.
await page.setViewportSize({ width: 1280, height: 800 });
await retrato(page, "nexo-boas-vindas-1280");
await page.setViewportSize({ width: LARGURA, height: ALTURA });

await browser.close();

console.log(`\n${feitos.length} retratos em ${path.resolve(OUT)}`);
