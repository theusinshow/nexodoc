// FOLGA VERTICAL DE CADA FOLHA — mede, em px de palco (1080), onde termina o
// conteúdo mais baixo de cada folha e onde começa o cabeçalho. Serve para
// decidir quais folhas precisam de `denso` (margem menor) e quais não.
//
//   node scripts/medir-folga-apresentacao.mjs            (npm run dev noutro terminal)
//
// NÃO GASTA TOKEN.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1600, height: 1000 },
  reducedMotion: "reduce", // estado final na hora, sem esperar a coreografia
});
const p = await ctx.newPage();
await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}
for (const [rota, n] of [["/apresentacao", 19], ["/apresentacao/valores", 6]]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  for (let i = 1; i <= n; i++) {
    if (i > 1) await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(350);
    const m = await p.evaluate(() => {
      const palco = document.querySelector(".ap-palco");
      const folha = document.querySelector(".ap-folha:not(.ap-folha--sai)");
      const escala = palco.getBoundingClientRect().width / 1920;
      const topo = palco.getBoundingClientRect().top;
      let fundo = 0, cabeca = null;
      const vis = (el) => {
        let e = el;
        while (e && e !== folha) {
          if (getComputedStyle(e).opacity === "0") return false;
          e = e.parentElement;
        }
        return true;
      };
      // texto: pelos próprios glifos, e não pela caixa do contêiner
      const andar = document.createTreeWalker(folha, NodeFilter.SHOW_TEXT);
      let no;
      while ((no = andar.nextNode())) {
        if (!no.textContent.trim()) continue;
        const el = no.parentElement;
        if (!vis(el)) continue;
        const r = document.createRange();
        r.selectNodeContents(no);
        const b = r.getBoundingClientRect();
        if (b.height === 0) continue;
        const y = (b.top - topo) / escala;
        if (el.closest(".ap-cabeca")) cabeca = cabeca === null ? y : Math.min(cabeca, y);
        fundo = Math.max(fundo, (b.bottom - topo) / escala);
      }
      // folhas sem texto: canvas, réguas, pontos, botões com borda
      for (const el of folha.querySelectorAll("*")) {
        if (el.children.length > 0 && el.tagName !== "A") continue;
        if (el.textContent?.trim() && el.tagName !== "A") continue;
        if (!vis(el)) continue;
        const cs = getComputedStyle(el);
        const pinta = el.tagName === "CANVAS" || cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px" || cs.backgroundImage !== "none";
        if (!pinta) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        fundo = Math.max(fundo, (r.bottom - topo) / escala);
      }
      const denso = folha.classList.contains("ap-folha--denso");
      return { denso, cabeca: cabeca && Math.round(cabeca), fundo: Math.round(fundo), folga: Math.round(1080 - fundo) };
    });
    console.log(rota.padEnd(22), String(i).padStart(2), m.denso ? "denso " : "normal", "cabeca", m.cabeca, "fundo", m.fundo, "folga", m.folga);
  }
}
await b.close();
