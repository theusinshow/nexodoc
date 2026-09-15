// X1 — a sessão expira no meio da auditoria. Esperado (catálogo): aviso de
// sessão expirada; nada é perdido ao entrar de novo.
//
// A auditoria que já está no POST não relê a sessão: o servidor termina e grava
// sozinho. O que a tela vê no meio é a RECONEXÃO — depois de um F5, o palco
// pergunta por GET /api/audits/<id> a cada 5s, e é essa pergunta que leva o 401.
// Então: auditar com leitura global de 30s, F5 com sessão, apagar os cookies e
// olhar o que a tela faz; depois entrar de novo pelo caminho que ela oferecer.
export default {
  id: "x1",
  area: "acesso",
  titulo:
    "sessão expira no meio: a tela avisa, para de perguntar e nada se perde",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-global", "lento:30000");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await page.waitForTimeout(5000);
    const id = await ctx.conversaAberta();
    const antes = await ctx.lerConversa(id);
    const bilhete = antes?.auditoriaPendente ?? null;
    ctx.verificar(
      "o bilhete está no disco antes do F5",
      Boolean(bilhete?.auditId),
      JSON.stringify(bilhete),
    );
    if (!bilhete?.auditId) return;

    // Conta as perguntas por GET /api/audits/<id> a partir do F5 (a aba que
    // dispara não se reconecta a si mesma — antes do F5 não há pergunta
    // nenhuma). Sem essa contagem ANTES do corte, "parou de perguntar" também
    // passaria para uma tela que nunca chegou a perguntar nada.
    const perguntasComSessao = ctx.contarRequisicoes(
      (req) => new URL(req.url()).pathname === `/api/audits/${bilhete.auditId}`,
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    const retomada = page.getByText(
      "Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar.",
    );
    await retomada
      .first()
      .waitFor({ timeout: 60_000 })
      .catch(() => {});
    ctx.verificar(
      "com sessão, o palco reconectou à análise, visível de verdade",
      (await retomada.count()) > 0 && (await ctx.visivelRolando(retomada)),
      `contagem=${await retomada.count()}`,
    );

    // O intervalo entre perguntas é de 5s (INTERVALO_MS em
    // use-reconectar-auditoria.ts), mas a primeira pergunta dispara no mount:
    // 8s de folga é o suficiente para provar que a tela ESTAVA perguntando com
    // a sessão intacta, antes do corte.
    await ctx.esperar(() => perguntasComSessao.total() > 0, 8_000);
    const perguntasAntesDoCorte = perguntasComSessao.total();
    perguntasComSessao.parar();

    // A sessão é só o cookie JWT: sem ele, toda rota da auditoria responde 401.
    await page.context().clearCookies();

    const faixa = page.getByText("Sessão expirada", { exact: true });
    await faixa
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(() => {});
    const faixaApareceu = await ctx.visivelRolando(faixa);
    ctx.verificar(
      "a faixa de sessão expirada aparece, visível de verdade",
      faixaApareceu,
      `contagem=${await faixa.count()}`,
    );

    const perguntasSemSessao = ctx.contarRequisicoes(
      (req) => new URL(req.url()).pathname === `/api/audits/${bilhete.auditId}`,
    );
    await page.waitForTimeout(12_000);
    perguntasSemSessao.parar();
    // Não vale só contar zero: uma tela quebrada que nunca perguntou nada (o
    // defeito vazio apontado pelo controlador em 15/09/2026) também daria zero
    // aqui. Só conta com a faixa acesa E a prova, acima, de que a tela estava
    // perguntando antes do corte.
    ctx.verificar(
      "sem sessão, a tela avisa e para de perguntar pela auditoria",
      faixaApareceu &&
        perguntasAntesDoCorte > 0 &&
        perguntasSemSessao.total() === 0,
      `faixa=${faixaApareceu} perguntas com sessão=${perguntasAntesDoCorte} perguntas sem sessão em 12s=${perguntasSemSessao.total()}`,
    );

    const durante = await ctx.lerConversa(id);
    ctx.verificar(
      "nada se perdeu: o bilhete e as mensagens seguem no disco",
      durante?.auditoriaPendente?.auditId === bilhete.auditId &&
        (durante?.messages?.length ?? 0) === (antes?.messages?.length ?? -1),
      `bilhete=${durante?.auditoriaPendente?.auditId} mensagens ${antes?.messages?.length} -> ${durante?.messages?.length}`,
    );

    // Entrar de novo pelo caminho da faixa; sem ela (produto de antes do conserto), pela porta.
    const entrar = page.getByRole("link", {
      name: "Entrar e continuar de onde parei",
    });
    if ((await entrar.count()) > 0) await entrar.first().click();
    else
      await page.goto(`${ctx.base}/login?callbackUrl=%2Fnexo`, {
        waitUntil: "domcontentloaded",
      });
    await page
      .getByRole("button", { name: /Entrar como dev/i })
      .click({ timeout: 30_000 });
    await page.waitForURL("**/nexo**", { timeout: 60_000 });

    const ver = await ctx.esperarParecer(1, 180_000);
    ctx.verificar(
      "depois de entrar de novo, o parecer aparece, visível de verdade",
      (await ver.count()) === 1 && (await ctx.visivelRolando(ver)),
      `botões=${await ver.count()}`,
    );
    await page.waitForTimeout(1500);
    const depois = await ctx.lerConversa(id);
    const pareceres = (depois?.results ?? []).filter(
      (r) => r.kind === "auditoria",
    );
    ctx.verificar(
      "o parecer entrou no cartão do bilhete, e o bilhete saiu",
      pareceres.length === 1 &&
        pareceres[0].artifactId === bilhete.artifactId &&
        !depois?.auditoriaPendente,
      JSON.stringify({
        pareceres: pareceres.map((r) => r.artifactId),
        pendente: depois?.auditoriaPendente,
      }),
    );
    const { linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "a auditoria concluiu no servidor",
      linhas.length === 1 && linhas[0].status === "COMPLETED",
      JSON.stringify(linhas),
    );
  },
};
