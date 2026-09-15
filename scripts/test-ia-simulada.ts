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
  iaSimuladaLigada as iaSimuladaLigadaReexportada,
  limparFila,
  respostaSimulada,
  streamSimulado,
  verFila,
} from "../lib/ia-simulada.ts";
import { iaSimuladaLigada } from "../lib/ia-simulada-ligada.ts";

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
  assert.equal(iaSimuladaLigada({ NEXODOC_IA_SIMULADA: "true", NODE_ENV: "development" }), false);
  // A mesma função que o `ai-runner` usa, e não uma cópia.
  assert.equal(iaSimuladaLigadaReexportada, iaSimuladaLigada);
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

/** O pedido da rota do selo: prompt, texto extraído do PDF e o recorte. */
function pedidoDeSelo(textoExtraido: string | null) {
  const prompt =
    "Você lê carimbos. Exemplo: ARQUIVO: 040_26_est_imp_001_a" +
    (textoExtraido === null ? "" : `\n\nTEXTO EXTRAÍDO:\n${textoExtraido}`);
  return {
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: "data:image/png;base64,AA==", detail: "high" },
        ],
      },
    ],
  };
}

const CAMPOS_DO_SELO = [
  "disciplina", "folha", "total", "numeroFolha", "arquivo", "conteudo", "cliente",
  "secretaria", "obra", "fase", "tituloSecao", "data", "logoOrgao", "confianca",
];

await test("selo legível sai do texto extraído, com os 14 campos do schema", async () => {
  const texto = [
    "REGIAO DO SELO (medida pelos rotulos do carimbo):",
    "CLIENTE:",
    "PREFEITURA MUNICIPAL DE CIDADE FICTICIA",
    "CONTEÚDO:",
    "PLANTA DE FORMAS DO BLOCO A",
    "PRANCHA:",
    "01/03",
    "ARQUIVO:",
    "990_26_est_001_a",
    "",
    "PAGINA COMPLETA:",
    "CLIENTE:",
  ].join("\n");
  const r = await respostaSimulada({ operation: "nexo-selo", model: "m", request: pedidoDeSelo(texto) });
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  assert.deepEqual(Object.keys(selo).sort(), [...CAMPOS_DO_SELO].sort());
  // O exemplo do PROMPT não pode virar leitura: só vale o que veio depois do marcador.
  assert.equal(selo.arquivo, "990_26_est_001_a");
  assert.equal(selo.disciplina, "EST");
  assert.equal(selo.conteudo, "PLANTA DE FORMAS DO BLOCO A");
  assert.equal(selo.numeroFolha, "01/03");
  assert.equal(selo.folha, 1);
  assert.equal(selo.total, 3);
  assert.equal(selo.cliente, "PREFEITURA MUNICIPAL DE CIDADE FICTICIA");
  assert.equal(selo.confianca, "alta");
});

await test("carimbo sem texto legível volta VAZIO, e não com erro", async () => {
  const texto = "REGIAO DO SELO (aproximada: nenhum rotulo encontrado):\n\n\nPAGINA COMPLETA:\n";
  const r = await respostaSimulada({ operation: "nexo-selo", model: "m", request: pedidoDeSelo(texto) });
  assert.equal(r.status, "completed");
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  for (const campo of CAMPOS_DO_SELO.filter((c) => c !== "confianca")) {
    assert.equal(selo[campo], null, campo);
  }
  assert.equal(selo.confianca, "baixa");
});

await test("foto de carimbo sem texto extraído também volta vazia", async () => {
  const r = await respostaSimulada({ operation: "nexo-selo-image", model: "m", request: pedidoDeSelo(null) });
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  assert.equal(selo.arquivo, null);
  assert.equal(selo.confianca, "baixa");
});

/** Pedido com texto e N imagens, como selo-check e volume-check montam. */
function pedidoComImagens(n: number) {
  return {
    instructions: "confira",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${n} recorte(s) de carimbo, nesta ordem: ...` },
          ...Array.from({ length: n }, () => ({ type: "input_image", image_url: "data:image/png;base64,AA==" })),
        ],
      },
    ],
  };
}

await test("identidade do selo: uma leitura nula por imagem, na ordem", async () => {
  const r = await respostaSimulada({ operation: "nexo-selo-identidade", model: "m", request: pedidoComImagens(3) });
  const corpo = JSON.parse(r.output_text) as { leituras: Record<string, unknown>[] };
  assert.equal(corpo.leituras.length, 3);
  assert.deepEqual(corpo.leituras[0], {
    endereco: null, orgao: null, logoPresente: false, logoOrgao: null,
    numeracaoTexto: null, folha: null, total: null,
  });
});

await test("conferência do volume: uma leitura nula por imagem", async () => {
  const r = await respostaSimulada({ operation: "nexo-volume-check", model: "m", request: pedidoComImagens(2) });
  const corpo = JSON.parse(r.output_text) as { leituras: Record<string, unknown>[] };
  assert.equal(corpo.leituras.length, 2);
  assert.deepEqual(Object.keys(corpo.leituras[1]).sort(), [
    "codigo", "disciplina", "folha", "numeracaoTexto", "obra", "orgao", "titulo", "total",
  ]);
});

/** A cauda JSON de uma resposta do agente. */
function propostasDaResposta(texto: string) {
  const cauda = texto.slice(texto.indexOf("```"));
  return (JSON.parse(cauda.replace(/```json|```/g, "")) as { proposals: Record<string, unknown>[] }).proposals;
}

await test("agente propõe LD com o título que o engenheiro disse", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\ncria a LD dessas pranchas com o título BATERIA V1\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.deepEqual(propostasDaResposta(r.output_text), [
    { kind: "ld", resumo: "LD", tituloLd: "BATERIA V1", numTomos: 1, tomoInicial: 1 },
  ]);
});

await test("agente propõe volume quando o pedido é montar", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\nmonta o volume\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.deepEqual(propostasDaResposta(r.output_text), [{ kind: "volume", resumo: "Volume" }]);
});

console.log(`\n${passed} teste(s) passaram`);
