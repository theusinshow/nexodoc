import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
let f = 0; const ok=(n,c,d="")=>{console.log((c?"  OK      ":"  FALHOU  ")+n+(c?"":" :: "+d)); if(!c) f++;};
await p.goto("http://localhost:3000/nexo", { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) { await p.getByRole("button", { name: /Entrar como dev/i }).click(); await p.waitForURL("**/nexo**"); }
await p.waitForTimeout(2000);
const aviso = p.locator(".nexo-shell__estreito");
const chat = p.locator(".nexo-shell__copilot");
ok("no desktop o aviso esta oculto", !(await aviso.isVisible()));
ok("no desktop o chat aparece", await chat.isVisible());
for (const [w,h,nome] of [[390,844,"celular"],[820,1180,"tablet"],[1023,800,"1023px"]]) {
  await p.setViewportSize({ width:w, height:h }); await p.waitForTimeout(700);
  ok(`${nome}: aviso visivel`, await aviso.isVisible());
  ok(`${nome}: sem chat solto`, !(await chat.isVisible()));
}
await p.setViewportSize({ width:1025, height:800 }); await p.waitForTimeout(700);
ok("em 1025px o produto volta", !(await aviso.isVisible()) && await chat.isVisible());
await p.setViewportSize({ width:390, height:844 }); await p.waitForTimeout(600);
await p.screenshot({ path: "./scratchpad/qa/w1-tela-estreita.png" });
await b.close();
console.log(f===0?"\nTudo OK":`\n${f} falha(s)`); process.exit(f===0?0:1);
