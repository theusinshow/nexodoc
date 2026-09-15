// X2 — memorial sem centro de custo legível. Decidido pelo Matheus em
// 15/09/2026: o cartão mostra um seletor com os projetos do escritório;
// escolher libera a auditoria; sem escolha, não gasta.
//
// "Não gasta" é medido duas vezes: nenhuma chamada a POST /api/audit e nenhuma
// linha nova em "Audit" (as jornadas rodam uma de cada vez, então contar a
// tabela antes e depois é contar só esta). Cada uma das duas checagens também
// exige o cartão do impasse VISÍVEL na tela (ctx.visivelRolando) — sem isso,
// uma tela que quebrasse antes de chegar ao impasse (ex.: o memorial não foi
// reconhecido) também daria "zero pedidos" e "zero linhas novas", só que por
// um motivo vazio. Ver ruling P5 do controlador em 15/09/2026.
const FRASE =
  "Não achei o centro de custo no documento. Escolha o projeto desta auditoria.";

export default {
  id: "x2",
  area: "acesso",
  titulo: "memorial sem código: o cartão pede o projeto antes de gastar",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    const contarAuditorias = async () =>
      (await ctx.banco.consultar(`select count(*)::int as n from "Audit"`))[0]
        .n;

    await ctx.abrirCartaoDeAuditoria(f.memorialSemCodigo);
    const auditoriasAntes = await contarAuditorias();
    // Criado ANTES do gesto que dispara o impasse: é o que prova que o
    // contador esteve ativo durante o clique, e não só depois dele.
    const pedidos = ctx.contarRequisicoes(
      (req) =>
        req.method() === "POST" && new URL(req.url()).pathname === "/api/audit",
    );
    await ctx.auditarNoCartao();

    const seletor = page.getByLabel(FRASE);
    await seletor.waitFor({ timeout: 30_000 }).catch(() => {});
    ctx.verificar(
      "o cartão mostra o seletor de projeto, visível de verdade",
      await ctx.visivelRolando(seletor),
      `contagem=${await seletor.count()}`,
    );
    const opcoes =
      (await seletor.count()) > 0
        ? await seletor.locator("option").allInnerTexts()
        : [];
    ctx.verificar(
      "o seletor lista os projetos do escritório",
      opcoes.includes("099-25 · CRICIÚMA") &&
        opcoes.includes("063-26 · CRICIÚMA"),
      JSON.stringify(opcoes),
    );
    const botao = page.getByRole("button", { name: "Auditar neste projeto" });
    const botaoPresente = (await botao.count()) === 1;
    const botaoVisivel = botaoPresente && (await ctx.visivelRolando(botao));
    ctx.verificar(
      "sem escolha, o botão não libera",
      botaoVisivel && (await botao.isDisabled()),
      `botões=${await botao.count()} visível=${botaoVisivel}`,
    );

    // O cartão do impasse, visível de verdade: a frase que hoje já sai em
    // `CardError` (ConfirmationCard.tsx, "O ENDEREÇO ANTES DO TRABALHO"). É a
    // evidência não vazia das duas checagens de "não gasta" abaixo — sem ela,
    // "zero pedidos" também seria verdade para uma tela que travou antes de
    // chegar ao impasse (memorial não reconhecido, por exemplo).
    const impasse = page.getByText(FRASE).first();
    const impasseVisivel =
      (await impasse.count()) > 0 && (await ctx.visivelRolando(impasse));

    await page.waitForTimeout(3000);
    ctx.verificar(
      "sem escolha, nenhuma auditoria foi pedida ao servidor",
      impasseVisivel && pedidos.total() === 0,
      `impasse visível=${impasseVisivel} pedidos=${pedidos.total()}`,
    );
    const auditoriasSemEscolha = await contarAuditorias();
    ctx.verificar(
      "sem escolha, nenhuma auditoria nova no banco",
      impasseVisivel && auditoriasSemEscolha === auditoriasAntes,
      `impasse visível=${impasseVisivel} ${auditoriasAntes} -> ${auditoriasSemEscolha}`,
    );
    if ((await seletor.count()) === 0) return;

    await seletor.selectOption({ label: "099-25 · CRICIÚMA" });
    await botao.click();
    await ctx.esperarParecer(1);
    pedidos.parar();
    ctx.verificar(
      "escolhido o projeto, a auditoria foi pedida uma vez",
      pedidos.total() === 1,
      `pedidos=${pedidos.total()}`,
    );

    const id = await ctx.conversaAberta();
    const [projeto] = await ctx.banco.consultar(
      `select id from "Project" where code = '099-25' and "organizationId" = 'org-prosul'`,
    );
    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "a auditoria rodou e concluiu no projeto escolhido",
      Boolean(projeto) &&
        registradas.length === 1 &&
        linhas.length === 1 &&
        linhas[0].status === "COMPLETED" &&
        linhas[0].projectId === projeto.id,
      `projeto=${projeto?.id} ${JSON.stringify(linhas)}`,
    );
    ctx.verificar(
      "a conversa ficou endereçada ao projeto escolhido",
      (await ctx.lerConversa(id))?.projectId === projeto?.id,
      `conversa=${(await ctx.lerConversa(id))?.projectId}`,
    );
  },
};
