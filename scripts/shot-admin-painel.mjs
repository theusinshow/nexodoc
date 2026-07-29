import { chromium } from "playwright";
const TOKEN = process.env.ADM_TOKEN;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
let f=0; const ok=(n,c,d="")=>{console.log((c?"  OK      ":"  FALHOU  ")+n+(c?"":" :: "+d)); if(!c) f++;};
await p.goto("http://localhost:3000/nexo", { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) { await p.getByRole("button", { name: /Entrar como dev/i }).click(); await p.waitForURL("**/nexo**"); }

await p.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
await p.locator('input[type="password"]').first().fill(TOKEN);
await p.getByRole("button", { name: /Atualizar/i }).first().click();
await p.waitForTimeout(3500);
const t = await p.locator("body").innerText();
ok("as auditorias tem NOME", !/Auditoria sem identificação/i.test(t), t.slice(0,200));
ok("e projeto", !/Projeto não informado/i.test(t));
ok("a fileira de acoes nao repete Usuarios/LDs/Auditorias", (t.match(/Adicionar, promover e desativar/g) ?? []).length === 0);
await p.screenshot({ path: "./scratchpad/qa/adm3-overview.png", fullPage: true });

// O cartao Falhas leva a lista JA filtrada.
await p.getByText("Falhas").first().click();
await p.waitForTimeout(3000);
ok("o cartao Falhas navega", p.url().includes("/admin/audits"), p.url());
const sel = p.locator("select").first();
ok("e chega com o filtro aplicado", (await sel.inputValue()) === "FAILED", await sel.inputValue());
await p.screenshot({ path: "./scratchpad/qa/adm3-falhas.png", fullPage: true });
const t2 = await p.locator("body").innerText();
ok("a lista de auditorias tambem tem nome", !/Auditoria sem identificação/i.test(t2));
await b.close();
console.log(f===0?"\nTudo OK":`\n${f} falha(s)`); process.exit(f===0?0:1);
