// A PROVA DAS FOLHAS MEXIDAS — 09/09/2026.
//
// O deck e o anexo são conteúdo, e conteúdo não quebra o build quando erra: ele
// erra na sala. Este script abre as folhas alteradas e mede o que uma asserção
// de DOM não mede — se o texto CABE na folha de 1080px e se a folha nova do
// anexo não estourou a altura.
//
// NÃO GASTA TOKEN: só desenha telas que já existem.
//
//   npm run dev            (noutro terminal)
//   node scripts/shot-apresentacao-folhas.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SAIDA = "./scratchpad/qa";

const navegador = await chromium.launch();
const p = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });
let falhas = 0;
const ok = (nome, condicao, detalhe = "") => {
  console.log(
    (condicao ? "  OK      " : "  FALHOU  ") +
      nome +
      (condicao ? "" : " :: " + detalhe),
  );
  if (!condicao) falhas++;
};

await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}

/** Anda até a folha `n` do percurso e devolve o texto dela. */
async function folha(rota, n, arquivo) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  for (let i = 1; i < n; i++) {
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(120);
  }
  // A ENTRADA ESCALONADA CHEGA A 1460ms: capturar antes disso fotografa meia folha.
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `${SAIDA}/${arquivo}.png` });
  const caixa = await p.locator(".ap-folha:not(.ap-folha--sai)").first().boundingBox();
  const texto = await p.locator(".ap-folha:not(.ap-folha--sai)").first().innerText();
  return { texto, caixa };
}

// ── o deck ────────────────────────────────────────────────────────────────
const d09 = await folha("/apresentacao", 9, "ap-09-limites");
ok(
  "folha 09 não fala mais de PDF escaneado",
  !/escaneado/i.test(d09.texto),
  d09.texto.slice(0, 120),
);

const d10 = await folha("/apresentacao", 10, "ap-10-seguranca");
ok(
  "folha 10 separa modelo de sistema",
  /treina o modelo/i.test(d10.texto) && /feedback/i.test(d10.texto),
);
ok("folha 10 não fala mais de chave de IA", !/chave de IA/i.test(d10.texto));

const d15 = await folha("/apresentacao", 15, "ap-15-se-voce-sair");
ok(
  "folha 15 é a da saída",
  /E se você sair/i.test(d15.texto),
  d15.texto.slice(0, 140),
);
ok(
  "folha 15 não fala de CNPJ nem de crachá na pergunta",
  !/CNPJ/i.test(d15.texto),
);

const d16 = await folha("/apresentacao", 16, "ap-16-motivo-da-venda");
ok(
  "folha 16 é Motivo da venda",
  /Motivo da venda/i.test(d16.texto),
  d16.texto.slice(0, 140),
);
ok(
  "folha 16 não tem pergunta acusatória",
  !/nosso funcionário/i.test(d16.texto),
);
ok(
  "folha 16 diz que serve a outras empresas",
  /outras empresas/i.test(d16.texto),
);

const d17 = await folha("/apresentacao", 17, "ap-17-quanto-custa-usar");
ok(
  "folha 17 é a do botão dos valores",
  /Quanto custa usar/i.test(d17.texto),
  d17.texto.slice(0, 120),
);

const d19 = await folha("/apresentacao", 19, "ap-19-fim");
ok(
  "o deck termina em 19",
  /O que esta ferramenta não é/i.test(d19.texto),
  d19.texto.slice(0, 120),
);

// ── o anexo ───────────────────────────────────────────────────────────────
const rotulos = [
  "A-piloto",
  "B-operar",
  "C-construir",
  "D-proposta",
  "E-de-onde-sai",
  "F-propriedade",
];
for (let i = 0; i < rotulos.length; i++) {
  const f = await folha("/apresentacao/valores", i + 1, `val-${rotulos[i]}`);
  // A FOLHA É 1080px E NÃO ROLA. Texto que passa disso some no projetor.
  const altura = await p
    .locator(".ap-folha:not(.ap-folha--sai)")
    .first()
    .evaluate((el) =>
      Math.max(
        el.scrollHeight,
        ...[...el.querySelectorAll("*")].map(
          (f) =>
            f.getBoundingClientRect().bottom - el.getBoundingClientRect().top,
        ),
      ),
    );
  ok(
    `anexo ${rotulos[i]} cabe em 1080px (${altura}px)`,
    altura <= 1081,
    `${altura}px`,
  );
}

const anexoA = await folha("/apresentacao/valores", 1, "val-A-piloto");
ok(
  "o anexo começa pelo escopo do piloto",
  /Piloto de seis meses/i.test(anexoA.texto),
  anexoA.texto.slice(0, 120),
);

await navegador.close();
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
