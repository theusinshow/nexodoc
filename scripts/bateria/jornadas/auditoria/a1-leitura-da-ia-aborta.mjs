// A1 — o caso do 117_25 em 14/09/2026 15:45: a leitura global abortou e o parecer
// saiu só com as regras. Tem de dizer isso em vermelho e gravar no banco.
export default {
  id: "a1",
  area: "auditoria",
  titulo: "leitura da IA aborta: parecer avisa e grava",
  async rodar(ctx) {
    // O banco NÃO é esvaziado entre jornadas (só uma vez, no início da bateria
    // inteira): numa corrida completa a1 roda antes de a3 no MESMO banco, e
    // "a auditoria mais recente" sem filtro pegaria a de a3 se ela já tivesse
    // gravado a sua. Cada jornada só lê o que ELA MESMA criou.
    const inicio = new Date();
    await ctx.login();
    await ctx.ia.fila("audit-global", "abortar");

    await ctx.anexar(["tests/117_25_md_geral_a.pdf"]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();

    // O documento tem folhas mudas: o cartão oferece as duas saídas. Aqui interessa
    // a leitura da IA, não a transcrição.
    const semTranscrever = await ctx.esperarBotao(/Auditar sem transcrever|^Auditar$/, 120_000);
    await semTranscrever.click();

    await ctx.esperarTexto(/A IA NÃO LEU O DOCUMENTO/, 600_000);

    // Presença no DOM não basta (regra R11): rola até o elemento antes de medir,
    // senão um aviso fora da dobra passaria em `count()` sem chegar aos olhos de
    // quem lê a tela. A contagem some no detalhe, não na condição.
    const aviso = ctx.page.getByText(/AUDITORIA INCOMPLETA — A IA NÃO LEU O DOCUMENTO/);
    ctx.verificar("aviso vermelho visível", await ctx.visivelRolando(aviso), `contagem=${await aviso.count()}`);

    const contagem = ctx.page.getByText(/contagem INCOMPLETA/);
    ctx.verificar(
      "contagem marcada como incompleta, visível de verdade",
      await ctx.visivelRolando(contagem),
      `contagem=${await contagem.count()}`,
    );

    const [audit] = await ctx.banco.consultar(
      `select status, report->'runtime'->'passadas_incompletas' as passadas from "Audit" where "createdAt" >= $1 order by "createdAt" desc limit 1`,
      [inicio],
    );
    ctx.verificar("auditoria gravada como COMPLETED", audit?.status === "COMPLETED", audit?.status);
    ctx.verificar(
      "a etapa que falhou está no parecer gravado",
      JSON.stringify(audit?.passadas ?? []).includes("Leitura global"),
      JSON.stringify(audit?.passadas),
    );
  },
};
