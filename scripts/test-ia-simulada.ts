/**
 * Teste da IA SIMULADA — o modelo falso que a bateria usa.
 *
 * A bateria roda os fluxos esquisitos sem gastar token. O simulador responde por
 * operação, com JSON válido para o formato de cada uma, e falha DE PROPÓSITO
 * quando o cenário pede: é assim que "a leitura global abortou aos 900s"
 * (117_25, 14/09/2026) vira teste de segundos.
 *
 *   node scripts/test-ia-simulada.ts   (== npm run test:ia-simulada)
 */
import assert from "node:assert/strict";

import {
  comportamentoValido,
  enfileirar,
  iaSimuladaLigada,
  limparFila,
  respostaSimulada,
  streamSimulado,
  verFila,
} from "../lib/ia-simulada.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  limparFila();
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const DOCUMENTO = [
  "--- PAGINA 1 ---",
  "VOLUME 1",
  "--- PAGINA 3 ---",
  "O reservatório superior tem capacidade de 10 m³ conforme o projeto hidráulico.",
  "--- PAGINA 7 ---",
  "As instalações elétricas seguem a NBR 5410 e o padrão da concessionária local.",
  "--- PAGINA 9 ---",
  "A cobertura será em telha metálica termoacústica com inclinação mínima de 5%.",
].join("\n");

await test("liga só com a variável E fora de produção", () => {
  assert.equal(iaSimuladaLigada({ NEXODOC_IA_SIMULADA: "1", NODE_ENV: "development" }), true);
  assert.equal(iaSimuladaLigada({ NEXODOC_IA_SIMULADA: "1", NODE_ENV: "production" }), false);
  assert.equal(iaSimuladaLigada({ NODE_ENV: "development" }), false);
});

await test("leitura global devolve achados ancorados em trechos reais, com a página", async () => {
  const r = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal(r.status, "completed");
  const corpo = JSON.parse(r.output_text) as { findings: { evidencia: string; pagina: string }[]; sintese: unknown[] };
  assert.ok(corpo.findings.length >= 1 && corpo.findings.length <= 3);
  for (const f of corpo.findings) {
    assert.ok(DOCUMENTO.includes(f.evidencia), `evidência inventada: ${f.evidencia}`);
  }
  assert.equal(corpo.findings[0].pagina, "3");
  assert.ok(Array.isArray(corpo.sintese));
});

await test("validação não mexe nos achados", async () => {
  const r = await respostaSimulada({ operation: "audit-validation", model: "m", request: { input: "x" } });
  assert.deepEqual(JSON.parse(r.output_text), { decisions: [] });
});

await test("agente propõe auditoria quando o pedido é auditar", async () => {
  const input = "REGRAS...\nPEDIDO DO ENGENHEIRO:\naudita o memorial\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  const cauda = r.output_text.slice(r.output_text.indexOf("```"));
  const json = JSON.parse(cauda.replace(/```json|```/g, "")) as { proposals: { kind: string }[] };
  assert.equal(json.proposals[0].kind, "auditoria");
});

await test("agente só conversa quando o pedido não é ação", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\noi, tudo bem?\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.ok(!r.output_text.includes('"kind"'));
});

await test("a fila é por operação e consumida na ordem", async () => {
  enfileirar("audit-global", "truncar");
  enfileirar("audit-validation", "503");
  enfileirar("audit-global", "abortar");
  const truncada = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal(truncada.status, "incomplete");
  assert.equal(truncada.incomplete_details?.reason, "max_output_tokens");
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }),
    (e: Error) => e.name === "AbortError" && /aborted/i.test(e.message),
  );
  assert.deepEqual(verFila(), [{ operation: "audit-validation", comportamento: "503" }]);
});

await test("503 carrega o status, para a retentativa reconhecer", async () => {
  enfileirar("audit-global", "503");
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }),
    (e: Error & { status?: number }) => e.status === 503,
  );
});

await test("recusa e JSON inválido saem no formato do provedor", async () => {
  enfileirar("audit-global", "recusar");
  enfileirar("audit-global", "json-invalido");
  const recusa = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal((recusa.output[0] as { content: { type: string }[] }).content[0].type, "refusal");
  const invalido = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.throws(() => JSON.parse(invalido.output_text));
});

await test("lento respeita o aborto do prazo", async () => {
  enfileirar("audit-global", "lento:5000");
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }, controller.signal),
    (e: Error) => e.name === "AbortError",
  );
});

await test("operação sem simulação quebra alto", async () => {
  await assert.rejects(
    respostaSimulada({ operation: "operacao-nova", model: "m", request: {} }),
    /operação sem simulação: operacao-nova/,
  );
});

await test("stream entrega o mesmo texto em pedaços e fecha com completed", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\naudita o memorial\n\nFormato da resposta, nesta ordem:";
  const eventos: { type: string; delta?: string; response?: { output_text: string } }[] = [];
  for await (const e of streamSimulado({ operation: "nexo-agent-turn", model: "m", request: { input } })) {
    eventos.push(e as never);
  }
  const texto = eventos.filter((e) => e.type === "response.output_text.delta").map((e) => e.delta).join("");
  const fim = eventos.at(-1)!;
  assert.equal(fim.type, "response.completed");
  assert.equal(texto, fim.response!.output_text);
});

await test("comportamentoValido aceita só a lista", () => {
  assert.equal(comportamentoValido("lento:1500"), true);
  assert.equal(comportamentoValido("lento:abc"), false);
  assert.equal(comportamentoValido("explodir"), false);
});

console.log(`\n${passed} teste(s) passaram`);
