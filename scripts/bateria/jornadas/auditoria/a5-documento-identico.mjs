// A5 — auditar o memorial até COMPLETED e auditar de novo o MESMO arquivo.
// Esperado (catálogo): recusa "O documento é idêntico…" legível no cartão, e
// nenhuma auditoria nova no banco.
//
// A base só serve se a primeira rodada saiu limpa (sem passada incompleta, sem
// folha muda pendente — lib/elegibilidade-da-base.ts). Por isso o memorial curto
// e a verificação da primeira rodada antes do gesto: sem ela, "não recusou"
// seria indistinguível de "a base não servia".
export default {
  id: "a5",
  area: "auditoria",
  titulo: "documento idêntico: recusa legível e nenhuma auditoria nova no banco",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await ctx.esperarParecer(1);
    await ctx.page.waitForTimeout(1500);

    const id = await ctx.conversaAberta();
    const primeira = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "a primeira rodada saiu COMPLETED e sem passada incompleta (base que serve)",
      primeira.linhas.length === 1 &&
        primeira.linhas[0].status === "COMPLETED" &&
        (primeira.linhas[0].passadas ?? []).length === 0,
      JSON.stringify(primeira.linhas),
    );

    await (await ctx.esperarBotao(/^Auditar de novo$/, 30_000)).click();
    await ctx.auditarNoCartao();

    const recusa = ctx.page.getByText(/O documento é idêntico ao que foi auditado em \d{2}\/\d{2}\. Não há o que auditar\./);
    await recusa.first().waitFor({ timeout: 120_000 }).catch(() => {});
    ctx.verificar("a recusa aparece no cartão, visível de verdade", await ctx.visivelRolando(recusa), `contagem=${await recusa.count()}`);

    await ctx.page.waitForTimeout(2000);
    const conversa = await ctx.lerConversa(id);
    ctx.verificar("o bilhete da tentativa recusada não ficou no disco", !conversa?.auditoriaPendente, JSON.stringify(conversa?.auditoriaPendente));
    const pareceres = (conversa?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("continua um parecer só na conversa", pareceres.length === 1, `pareceres=${pareceres.length}`);

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    // O cartão registra o id ANTES do POST (`registrarAuditoria`), então a
    // conversa conhece dois ids: é por eles que o banco é consultado.
    ctx.verificar("a conversa registrou as duas tentativas", registradas.length === 2, `registradas=${registradas.length}`);
    const recusado = registradas[1]?.auditId;
    ctx.verificar(
      "o id recusado não deixou linha no banco",
      Boolean(recusado) && linhas.length === 1 && !linhas.some((l) => l.id === recusado),
      `recusado=${recusado} linhas=${JSON.stringify(linhas.map((l) => ({ id: l.id, status: l.status })))}`,
    );
  },
};
