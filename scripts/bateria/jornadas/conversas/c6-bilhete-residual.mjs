// C6 — conversa com o parecer PRONTO e um bilhete de auditoria em voo que
// sobrou para a MESMA auditoria (`auditoriaPendente` + resultado do mesmo
// artefato). Ao abrir, `useReconectarAuditoria` vê que o resultado já existe e
// limpa o bilhete com gravação imediata, de dentro de um effect do palco.
//
// DEFEITO PEGO POR ESTA JORNADA (15/09/2026, docs/bateria/defeitos-achados.md):
// entre `selectConversation` escrever à mão os campos da conversa aberta no
// snapshot e o commit que traz o id dela, uma gravação imediata lia o id da
// ANTERIOR com o memorial e o `createdAt` da aberta. Medido aqui: (1) no F5,
// "voltar para a última" e "retomar a auditoria em voo" abrem a mesma conversa
// duas vezes, e o flush da segunda gravou um registro fantasma "Nova conversa"
// com o memorial dela; (3) com A aberta e o palco montado, a retomada troca
// para D e o palco limpa o bilhete de D dentro do commit da troca — A foi
// gravada com o memorial e a data de D, e D ficou com o bilhete no disco.
// Teste puro que trava a regra: scripts/test-agenda-de-gravacao.ts.
//
// Três gestos: F5 caindo direto na conversa com bilhete; abrir pela barra a
// partir da tela em branco; F5 com outra conversa como última (o produto troca
// sozinho para a que tem bilhete).
import fs from "node:fs";

const fixture = JSON.parse(fs.readFileSync("scripts/bateria/fixtures/parecer-117-25-incompleto.json", "utf8"));
const AUDIT_ID = fixture.resultado.payload.auditId;

/** Conversa com parecer pronto e bilhete residual da mesma auditoria. */
function comBilheteResidual({ id, titulo, createdAt, agora }) {
  const artifactId = "auditoria:117-25:p1";
  return {
    id,
    title: titulo,
    createdAt,
    updatedAt: agora,
    seloResults: [],
    messages: [
      { id: "u1", role: "user", content: "Anexei o memorial — 117_25_md_geral_a.pdf" },
      { id: "p1", role: "assistant", content: "Vou auditar o memorial.", proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] },
    ],
    results: [{ ...fixture.resultado, artifactId, generatedAt: agora - 60_000 }],
    auditorias: [{ auditId: AUDIT_ID, artifactId }],
    auditoriaPendente: { auditId: AUDIT_ID, artifactId, nivel: "deep", arquivo: "117_25_md_geral_a.pdf", inicioMs: agora - 600_000 },
    memorial: { name: "117_25_md_geral_a.pdf", blobKey: `${id}:memorial` },
  };
}

export default {
  id: "c6",
  area: "conversas",
  titulo: "abrir conversa com bilhete residual não cria fantasma nem perde a conversa",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const agora = Date.now();
    const semeadas = new Set();
    const ultima = () => page.evaluate(() => localStorage.getItem("nexo:ultima-conversa"));
    const ler = async (id) => (await ctx.indexeddb.lerConversas()).find((c) => c.id === id);
    const extras = async () =>
      (await ctx.indexeddb.lerConversas()).filter((c) => !semeadas.has(c.id)).map((c) => `${c.id} memorial=${c.memorial?.blobKey ?? "-"}`);
    const esperarBilheteSair = async (id) => {
      const fim = Date.now() + 15_000;
      while (Date.now() < fim && (await ler(id))?.auditoriaPendente) await page.waitForTimeout(500);
      // Passa da janela do debounce: um fantasma gravado por último teria tempo de chegar ao disco.
      await page.waitForTimeout(1500);
    };
    const marcadaNaBarra = async (titulo) => {
      const marcada = page.locator('button[aria-current="true"]');
      const n = await marcada.count();
      const texto = n > 0 ? await marcada.first().innerText() : "";
      return { ok: n === 1 && texto.includes(titulo), detalhe: `marcadas=${n} texto=${JSON.stringify(texto.slice(0, 80))}` };
    };

    // ── 1. F5 caindo direto na conversa com bilhete ──────────────────────────
    const idB = `bateria-c6-b-${agora}`;
    semeadas.add(idB);
    await ctx.indexeddb.gravarConversa(comBilheteResidual({ id: idB, titulo: "BATERIA C6 B", createdAt: agora - 7_200_000, agora }));
    await page.evaluate((id) => localStorage.setItem("nexo:ultima-conversa", id), idB);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await esperarBilheteSair(idB);

    const recB = await ler(idB);
    ctx.verificar("F5: nenhuma conversa a mais no disco", (await extras()).length === 0, JSON.stringify(await extras()));
    ctx.verificar("F5: a conversa lembrada continua sendo a aberta", (await ultima()) === idB, await ultima());
    ctx.verificar("F5: o bilhete residual saiu do disco", !recB?.auditoriaPendente, JSON.stringify(recB?.auditoriaPendente));
    ctx.verificar(
      "F5: a conversa guarda o próprio memorial e a data de criação",
      recB?.memorial?.blobKey === `${idB}:memorial` && recB?.createdAt === agora - 7_200_000,
      `memorial=${recB?.memorial?.blobKey} createdAt=${recB?.createdAt}`,
    );
    ctx.verificar("F5: o parecer continua no disco", recB?.results?.length === 1, `results=${recB?.results?.length}`);

    // Segundo F5: se um fantasma tivesse virado a "última conversa", abriria em branco aqui.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    ctx.verificar("F5 de novo: a mesma conversa volta", (await ultima()) === idB, await ultima());
    const barra1 = await marcadaNaBarra("BATERIA C6 B");
    ctx.verificar("F5 de novo: a barra marca a conversa com o parecer", barra1.ok, barra1.detalhe);
    ctx.verificar("F5 de novo: nenhuma conversa a mais no disco", (await extras()).length === 0, JSON.stringify(await extras()));

    // ── 2. Abrir pela barra a partir da tela em branco ───────────────────────
    const idC = `bateria-c6-c-${agora}`;
    semeadas.add(idC);
    await ctx.indexeddb.gravarConversa(comBilheteResidual({ id: idC, titulo: "BATERIA C6 C", createdAt: agora - 5_400_000, agora }));
    await page.evaluate(() => localStorage.removeItem("nexo:ultima-conversa"));
    await ctx.abrirConversa("BATERIA C6 C");
    await esperarBilheteSair(idC);

    const recC = await ler(idC);
    ctx.verificar("da tela em branco: nenhuma conversa a mais no disco", (await extras()).length === 0, JSON.stringify(await extras()));
    ctx.verificar("da tela em branco: a conversa lembrada é a aberta", (await ultima()) === idC, await ultima());
    ctx.verificar("da tela em branco: o bilhete residual saiu do disco", !recC?.auditoriaPendente, JSON.stringify(recC?.auditoriaPendente));
    ctx.verificar(
      "da tela em branco: memorial e data de criação da própria conversa",
      recC?.memorial?.blobKey === `${idC}:memorial` && recC?.createdAt === agora - 5_400_000,
      `memorial=${recC?.memorial?.blobKey} createdAt=${recC?.createdAt}`,
    );

    // ── 3. F5 com A como última e o bilhete residual em OUTRA conversa ────────
    // O produto abre A ("voltar para onde parou") e logo em seguida troca
    // sozinho para D ("retomar a auditoria em voo", NexoWorkspace) — com o palco
    // de A já montado. É a troca em que o effect do palco limpa o bilhete de D
    // dentro do commit que traz D.
    const idA = `bateria-c6-a-${agora}`;
    const idD = `bateria-c6-d-${agora}`;
    semeadas.add(idA);
    semeadas.add(idD);
    const criadaA = agora - 3_600_000;
    await ctx.indexeddb.gravarConversa({
      id: idA,
      title: "BATERIA C6 A",
      createdAt: criadaA,
      updatedAt: agora,
      seloResults: [],
      messages: [
        { id: "a1", role: "user", content: "Anexei o memorial da outra obra" },
        { id: "a2", role: "assistant", content: "Recebi o memorial." },
      ],
      results: [],
      memorial: { name: "outra-obra.pdf", blobKey: `${idA}:memorial` },
    });
    await ctx.indexeddb.gravarConversa(comBilheteResidual({ id: idD, titulo: "BATERIA C6 D", createdAt: agora - 1_800_000, agora }));
    await page.evaluate((id) => localStorage.setItem("nexo:ultima-conversa", id), idA);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await esperarBilheteSair(idD);

    const recA = await ler(idA);
    const recD = await ler(idD);
    ctx.verificar("troca: nenhuma conversa a mais no disco", (await extras()).length === 0, JSON.stringify(await extras()));
    ctx.verificar(
      "troca: A continua com o próprio memorial e a própria data de criação",
      recA?.memorial?.blobKey === `${idA}:memorial` && recA?.createdAt === criadaA,
      `memorial=${recA?.memorial?.blobKey} createdAt=${recA?.createdAt}`,
    );
    ctx.verificar("troca: a conversa lembrada é a aberta", (await ultima()) === idD, await ultima());
    ctx.verificar("troca: o bilhete residual saiu do disco", !recD?.auditoriaPendente, JSON.stringify(recD?.auditoriaPendente));
    ctx.verificar(
      "troca: a aberta guarda o próprio memorial e a data de criação",
      recD?.memorial?.blobKey === `${idD}:memorial` && recD?.createdAt === agora - 1_800_000,
      `memorial=${recD?.memorial?.blobKey} createdAt=${recD?.createdAt}`,
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    ctx.verificar("troca + F5: a conversa aberta volta", (await ultima()) === idD, await ultima());
    const barraD = await marcadaNaBarra("BATERIA C6 D");
    ctx.verificar("troca + F5: a barra marca a conversa aberta", barraD.ok, barraD.detalhe);
    ctx.verificar("troca + F5: o bilhete não voltou", !(await ler(idD))?.auditoriaPendente);
  },
};
