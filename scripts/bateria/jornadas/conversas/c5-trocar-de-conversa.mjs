// C5 — auditar em A, abrir B durante a análise, esperar o servidor terminar
// com B aberta, voltar para A. Esperado (catálogo): a auditoria segue, o parecer
// aparece na conversa certa e não na outra.
//
// B é semeada ANTES de tudo, com título próprio, para existir na barra lateral e
// ser aberta por clique — a troca tem de acontecer na MESMA página, com o cartão
// de A ainda esperando a resposta. Um F5 aqui mataria a espera e testaria A4.
//
// ABRIR B NÃO É SÓ CLICAR NO TEXTO. A barra lateral é uma lista de CARTÕES de
// projeto (CartaoDeProjeto.tsx / ListaDeProjetos.tsx), um aberto por vez, e só o
// aberto renderiza a lista de conversas de dentro. Com A recém-vinculada a um
// projeto (o cartão dela abre sozinho, por ser a conversa ativa), B cai no
// balde "A endereçar" — FECHADO. Clicar direto no texto "BATERIA C5 B" sem abrir
// o cartão primeiro trava 30s e QUEBRA a jornada por um motivo que não é o
// dela (medido em 15/09/2026, lendo os dois componentes). A busca da barra
// ("Buscar obra ou código…") filtra as conversas de CADA cartão para as que
// batem com o texto — ela não abre o cartão sozinha, mas garante que só a B da
// CORRIDA ATUAL apareça ali, mesmo com corridas antigas da bateria deixando
// outras "BATERIA C5 B" no mesmo balde (o banco não é esvaziado entre corridas).
//
// A TROCA ÚNICA TEM DE FICAR DE PÉ (ruling R18, 15/09/2026). A retomada da
// auditoria em voo (`NexoWorkspace.tsx`, `retomouRef`) existe para o F5, mas
// disparava na PRIMEIRA vez que a conversa ativa se afastava de quem audita,
// mesmo num clique do engenheiro: medido com uma linha do tempo a cada 500ms
// (Tarefa 12, "Fix round 1"), B ficava marcada por ~1s e a tela voltava
// sozinha para A. Consertado na Tarefa 13 (`retomada-da-auditoria.ts`); a
// verificação "B continua aberta alguns segundos depois" é quem trava a volta.
async function abrirB(ctx, idB) {
  const { page } = ctx;
  await page
    .getByLabel("Buscar conversas por obra ou código")
    .fill("BATERIA C5 B");
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: /A endere.ar/i })
    .first()
    .click({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.getByText("BATERIA C5 B").first().click({ timeout: 30_000 });
  // Espera pelo EVENTO (a conversa aberta virou B), não por um relógio afinado
  // no puxão que existia: quem prova que B fica é a verificação seguinte.
  await ctx.esperar(
    async () => (await ctx.conversaAberta()) === idB,
    20_000,
    250,
  );
}
export default {
  id: "c5",
  area: "conversas",
  titulo:
    "trocar de conversa durante a auditoria não leva o parecer para a outra",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();

    const agora = Date.now();
    const idB = `bateria-c5-b-${agora}`;
    await ctx.indexeddb.gravarConversa({
      id: idB,
      title: "BATERIA C5 B",
      createdAt: agora - 3_600_000,
      updatedAt: agora - 3_600_000,
      seloResults: [],
      messages: [
        { id: "b1", role: "user", content: "conversa de controle da bateria" },
        { id: "b2", role: "assistant", content: "Entendido." },
      ],
      results: [],
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    // 30s, e não os 15s do resto da bateria: a folga garante que a auditoria de
    // A ainda esteja em voo quando as duas verificações de B rodarem (a de
    // "abriu" e a de "continua aberta alguns segundos depois").
    await ctx.ia.fila("audit-global", "lento:30000");
    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await page.waitForTimeout(3000);

    const idA = await ctx.conversaAberta();
    const bilhete = (await ctx.lerConversa(idA))?.auditoriaPendente ?? null;
    ctx.verificar(
      "A tem o bilhete no disco antes da troca",
      Boolean(bilhete?.auditId) && idA !== idB,
      `A=${idA} bilhete=${JSON.stringify(bilhete)}`,
    );
    if (!bilhete?.auditId) return;

    // Um clique só — o gesto natural do catálogo.
    await abrirB(ctx, idB);
    const barraB = await ctx.marcadaNaBarra("BATERIA C5 B");
    ctx.verificar(
      "B está aberta enquanto A audita",
      barraB.ok && (await ctx.conversaAberta()) === idB,
      barraB.detalhe,
    );

    // A retomada de uma vez só (ver topo do arquivo) reagia à primeira
    // divergência entre a conversa ativa e a que audita — e o clique acima era
    // a primeira desde o F5 que começou a auditoria. Esta verificação trava o
    // puxão: espera alguns segundos e confere se B AINDA está aberta, em vez de
    // já ter voltado para A sozinha.
    await page.waitForTimeout(3000);
    const barraBDepois = await ctx.marcadaNaBarra("BATERIA C5 B");
    ctx.verificar(
      "B continua aberta alguns segundos depois de aberta (a retomada não puxou de volta para A)",
      barraBDepois.ok && (await ctx.conversaAberta()) === idB,
      barraBDepois.detalhe,
    );

    // O servidor termina a auditoria de A com B aberta; depois, o cartão de A
    // recebe a resposta e decide onde gravar.
    const terminou = await ctx.esperar(
      async () => {
        const [linha] = await ctx.banco.consultar(
          `select status from "Audit" where id = $1`,
          [bilhete.auditId],
        );
        return linha?.status === "COMPLETED";
      },
      180_000,
      2000,
    );
    ctx.verificar("a auditoria de A seguiu até o fim no servidor", terminou);
    await page.waitForTimeout(5000);

    const barraAindaB = await ctx.marcadaNaBarra("BATERIA C5 B");
    const bAindaAberta = barraAindaB.ok && (await ctx.conversaAberta()) === idB;
    ctx.verificar(
      "B continuava aberta quando o parecer chegou",
      bAindaAberta,
      barraAindaB.detalhe,
    );

    // "B não ganhou parecer" só prova o que diz se a LEITURA achou a conversa B
    // de verdade — `lerConversa` devolvendo `null` (id errado, IndexedDB vazio)
    // passaria aqui vazio sem nunca ter olhado para B (regra P5, 15/09/2026).
    const recB = await ctx.lerConversa(idB);
    const pareceresEmB = (recB?.results ?? []).filter(
      (r) => r.kind === "auditoria",
    );
    ctx.verificar(
      "B não ganhou parecer no disco",
      recB?.id === idB && pareceresEmB.length === 0,
      `recB=${recB?.id ?? "null"} pareceres=${pareceresEmB.map((r) => r.artifactId).join(" | ")}`,
    );
    // E "a tela não mostra parecer" só prova o que diz se a tela em jogo É a de
    // B — sem isso, `count() === 0` também passaria com a tela em branco ou
    // noutra conversa, sem nunca ter olhado para B.
    // O botão "Ver o parecer" mora no cartão do chat de A, que B não tem: contar
    // só ele passou com o parecer de A aberto no canvas de B (captura de
    // 15/09/2026, Tarefa 13). O nome do memorial de A na tela é o que denuncia.
    const verEmB = await page
      .getByRole("button", { name: /Ver o parecer/ })
      .count();
    const arquivoDeAEmB = await page.getByText(bilhete.arquivo).count();
    ctx.verificar(
      "a tela de B não mostra parecer",
      bAindaAberta && verEmB === 0 && arquivoDeAEmB === 0,
      `B aberta=${bAindaAberta} (${barraAindaB.detalhe}) botões Ver o parecer=${verEmB} "${bilhete.arquivo}" na tela=${arquivoDeAEmB}`,
    );

    // De volta para A, como quem reabre o Nexo.
    await page.evaluate(
      (id) => localStorage.setItem("nexo:ultima-conversa", id),
      idA,
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    const ver = await ctx.esperarParecer(1, 120_000);
    ctx.verificar(
      "A mostra o parecer, visível de verdade",
      (await ver.count()) === 1 && (await ctx.visivelRolando(ver)),
      `botões Ver o parecer=${await ver.count()}`,
    );
    await page.waitForTimeout(1500);

    const recA = await ctx.lerConversa(idA);
    const pareceresEmA = (recA?.results ?? []).filter(
      (r) => r.kind === "auditoria",
    );
    ctx.verificar(
      "A tem um parecer, no cartão do bilhete",
      pareceresEmA.length === 1 &&
        pareceresEmA[0].artifactId === bilhete.artifactId,
      `pareceres=${pareceresEmA.map((r) => r.artifactId).join(" | ")} bilhete=${bilhete.artifactId}`,
    );
    ctx.verificar(
      "o bilhete de A saiu do disco",
      recA?.id === idA && !recA.auditoriaPendente,
      `recA=${recA?.id ?? "null"} bilhete=${JSON.stringify(recA?.auditoriaPendente)}`,
    );

    const recBNoFim = await ctx.lerConversa(idB);
    const pareceresEmBNoFim = (recBNoFim?.results ?? []).filter(
      (r) => r.kind === "auditoria",
    );
    ctx.verificar(
      "B segue sem parecer no fim",
      recBNoFim?.id === idB && pareceresEmBNoFim.length === 0,
      `recB=${recBNoFim?.id ?? "null"} pareceres em B=${pareceresEmBNoFim.length}`,
    );
  },
};
