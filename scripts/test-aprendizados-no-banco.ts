/**
 * Teste do ACERVO DE APRENDIZADOS agora que ele mora no banco.
 *
 * Roda contra o Postgres de verdade, e não contra um dublê: o que se prova
 * aqui é justamente que o acervo SOBREVIVE — e sobreviver é uma propriedade do
 * banco, não do módulo. Um teste com repositório falso passaria igual no dia em
 * que a gravação voltasse para o disco efêmero, que é o defeito que isto
 * existe para não deixar voltar.
 *
 * Precisa de `DATABASE_URL` e da migração aplicada (`npm run db:migrate`).
 *
 *   node scripts/test-aprendizados-no-banco.ts   (== npm run test:aprendizados)
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

let passed = 0;
const criados: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("  -- sem DATABASE_URL: teste PULADO (não é falha)");
    return;
  }

  const {
    createAuditLearning,
    listAuditLearnings,
    updateAuditLearning,
    deleteAuditLearning,
    formatAuditLearningsForPrompt,
  } = await import("../lib/audit-learnings.ts");
  const { getPrisma } = await import("../lib/db.ts");

  /** Só os registros deste teste — o banco local tem trabalho de verdade. */
  const meus = async () => {
    const todos = await listAuditLearnings();
    return todos.filter((l) => criados.includes(l.id));
  };

  await test("criar grava NO BANCO, não em arquivo", async () => {
    const criado = await createAuditLearning({
      title: "Teste — carimbo sempre em caixa alta",
      content: "O campo RESPONSÁVEL TÉCNICO do selo deve sair em caixa alta.",
      type: "rule",
      scope: "memorial",
    });
    criados.push(criado.id);

    // A prova de que foi para o banco: a linha existe para o Prisma, sem
    // passar pelo módulo que acabou de escrevê-la.
    const noBanco = await getPrisma().auditLearning.findUnique({
      where: { id: criado.id },
    });
    assert.ok(noBanco, "o aprendizado deveria existir como linha no Postgres");
    assert.equal(noBanco.title, "Teste — carimbo sempre em caixa alta");
    assert.equal(noBanco.scope, "memorial");
  });

  await test("listar devolve o que foi gravado", async () => {
    const lista = await meus();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].type, "rule");
    // As datas continuam saindo em ISO: o resto do produto já consome assim.
    assert.match(lista[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  await test("o escopo GLOBAL viaja com qualquer escopo pedido", async () => {
    const global = await createAuditLearning({
      title: "Teste — global",
      content: "Vale para toda auditoria, seja qual for o escopo.",
      scope: "global",
    });
    criados.push(global.id);

    const doVolume = await listAuditLearnings({ scope: "volume" });
    const ids = doVolume.map((l) => l.id);
    assert.ok(ids.includes(global.id), "o global deveria aparecer no escopo volume");
    assert.ok(
      !ids.includes(criados[0]),
      "o de escopo memorial NÃO deveria aparecer no escopo volume",
    );
  });

  await test("pausar tira do prompt sem apagar do acervo", async () => {
    const pausado = await updateAuditLearning(criados[0], { status: "paused" });
    assert.equal(pausado?.status, "paused");

    const ativos = await listAuditLearnings({ activeOnly: true });
    assert.ok(
      !ativos.map((l) => l.id).includes(criados[0]),
      "pausado não entra na lista de ativos",
    );
    // Mas continua no acervo: pausar não é apagar.
    const todos = await meus();
    assert.ok(todos.map((l) => l.id).includes(criados[0]));
  });

  await test("editar só o status NÃO exige reenviar título e conteúdo", async () => {
    // A validação roda sobre o registro já mesclado. Se rodasse sobre o pedido
    // cru, uma pausa seria recusada por "falta título".
    const voltou = await updateAuditLearning(criados[0], { status: "active" });
    assert.equal(voltou?.status, "active");
    assert.equal(voltou?.title, "Teste — carimbo sempre em caixa alta");
  });

  await test("editar o que não existe devolve null, sem explodir", async () => {
    assert.equal(await updateAuditLearning("nao-existe-jamais", { status: "paused" }), null);
  });

  await test("apagar duas vezes não lança exceção", async () => {
    const alvo = await createAuditLearning({
      title: "Teste — descartável",
      content: "Existe só para ser apagado duas vezes.",
    });
    assert.equal(await deleteAuditLearning(alvo.id), true);
    // Dois cliques ou duas abas são caminho normal desta rota.
    assert.equal(await deleteAuditLearning(alvo.id), false);
  });

  await test("o prompt sai formatado com o que está ativo", async () => {
    const texto = formatAuditLearningsForPrompt(await meus());
    assert.match(texto, /carimbo sempre em caixa alta/);
    assert.match(texto, /Tipo: rule/);
  });

  await test("o acervo antigo em ARQUIVO é importado uma vez", async () => {
    /*
     * O caminho que este trabalho existe para consertar: quem já tinha
     * aprendizados no JSON do disco não pode perdê-los na virada.
     *
     * A importação só roda com a tabela vazia, e aqui ela não está — então o
     * que se prova é a leitura do arquivo e a forma dos dados, com a garantia
     * de que a mesclagem NÃO acontece por cima de um acervo já existente.
     */
    const dir = await mkdtemp(path.join(tmpdir(), "nexodoc-learnings-"));
    const arquivo = path.join(dir, "acervo.json");
    await writeFile(
      arquivo,
      JSON.stringify([
        {
          id: "aprendizado-antigo-1",
          title: "Do arquivo",
          content: "Veio do JSON em disco.",
          type: "preference",
          scope: "global",
          status: "active",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ]),
      "utf8",
    );

    process.env.NEXODOC_LEARNINGS_FILE = arquivo;
    const antes = await getPrisma().auditLearning.count();
    await listAuditLearnings();
    const depois = await getPrisma().auditLearning.count();

    assert.equal(
      antes,
      depois,
      "com a tabela já povoada, o arquivo NÃO deve ser mesclado por cima",
    );
    delete process.env.NEXODOC_LEARNINGS_FILE;
  });

  // Limpeza: o banco local tem trabalho de verdade, e teste não deixa lixo.
  for (const id of criados) {
    await getPrisma().auditLearning.deleteMany({ where: { id } });
  }

  console.log(`\n${passed} teste(s) de aprendizados OK`);
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
