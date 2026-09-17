// RECALCULA `estimatedCostUsd` DOS EVENTOS JÁ GRAVADOS com a tabela de preço atual.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/recalcular-custo-de-ia.mjs [--dias 30] [--gravar]
//   (== npm run custo:recalcular -- ...)
//
// 17/09/2026: o gpt-5.6-sol estava a $5/$30 na tabela (preço do gpt-5.5); o certo
// é $4/$20. Todo painel soma o custo GRAVADO em cada evento, então corrigir a
// tabela só conserta dali para a frente. Este script conserta o passado.
//
// SEM `--gravar` NÃO ESCREVE NADA: mostra, por modelo, o total gravado e o total
// recalculado. Com `--gravar`, atualiza só os eventos cujo valor muda, numa
// transação, e só de modelos com preço conhecido (nulo continua nulo).
//
// O banco é o do DATABASE_URL do ambiente (.env.local por padrão). Para produção,
// passe DATABASE_URL explicitamente — o script diz em que banco está antes de agir.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { estimateOpenAiCostUsd } = await import("../lib/ai-precos.ts");

const args = process.argv.slice(2);
const gravar = args.includes("--gravar");
const iDias = args.indexOf("--dias");
const dias = iDias === -1 ? 3650 : Number(args[iDias + 1]);
if (!Number.isFinite(dias) || dias <= 0) throw new Error("--dias precisa ser um número positivo");

const banco = (process.env.DATABASE_URL ?? "").match(/\/([^/?]+)(\?|$)/)?.[1] ?? "?";
console.log(`banco: ${banco} · janela: ${dias} dia(s) · ${gravar ? "GRAVANDO" : "simulação (nada é escrito)"}`);

const prisma = getPrisma();
const desde = new Date(Date.now() - dias * 86_400_000);
const eventos = await prisma.aiUsageEvent.findMany({
  where: { createdAt: { gte: desde } },
  select: { id: true, model: true, inputTokens: true, outputTokens: true, cachedTokens: true, estimatedCostUsd: true },
});

const porModelo = new Map();
const mudancas = [];
for (const e of eventos) {
  const novo = estimateOpenAiCostUsd(e.model, {
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    cachedTokens: e.cachedTokens,
  });
  const linha = porModelo.get(e.model) ?? { eventos: 0, gravado: 0, recalculado: 0, mudam: 0 };
  linha.eventos++;
  linha.gravado += e.estimatedCostUsd ?? 0;
  linha.recalculado += novo ?? 0;
  if (novo !== null && Math.abs((e.estimatedCostUsd ?? 0) - novo) > 1e-9) {
    linha.mudam++;
    mudancas.push({ id: e.id, novo });
  }
  porModelo.set(e.model, linha);
}

/*
 * O campo `model` de produção guarda até uma chave de API colada no lugar do nome
 * (ver `validateAiModelName`). O relatório não pode reimprimi-la.
 */
const exibir = (modelo) => (/^sk-/i.test(modelo) ? "sk-… (chave de API no lugar do modelo)" : modelo);

const tabela = [...porModelo].map(([modelo, l]) => ({
  modelo: exibir(modelo),
  eventos: l.eventos,
  mudam: l.mudam,
  gravado: l.gravado.toFixed(2),
  recalculado: l.recalculado.toFixed(2),
}));
console.table(tabela);
const soma = (k) => [...porModelo.values()].reduce((t, l) => t + l[k], 0);
console.log(`total gravado US$ ${soma("gravado").toFixed(2)} → recalculado US$ ${soma("recalculado").toFixed(2)} · ${mudancas.length} evento(s) mudam`);

if (gravar && mudancas.length > 0) {
  /*
   * UM `UPDATE … FROM (VALUES …)`, e não um `update` por evento numa transação:
   * em 17/09/2026 as 447 idas e voltas ao Neon passaram dos 5 s da transação e
   * TUDO voltou atrás. Um comando só é atômico por si e cabe em uma viagem.
   */
  const valores = mudancas.map((_, i) => `($${2 * i + 1}::text, $${2 * i + 2}::double precision)`).join(", ");
  const parametros = mudancas.flatMap((m) => [m.id, m.novo]);
  const atualizados = await prisma.$executeRawUnsafe(
    `UPDATE "AiUsageEvent" AS e SET "estimatedCostUsd" = v.custo FROM (VALUES ${valores}) AS v(id, custo) WHERE e.id = v.id`,
    ...parametros,
  );
  console.log(`gravado: ${atualizados} evento(s) atualizados de ${mudancas.length}`);
}
await prisma.$disconnect();
