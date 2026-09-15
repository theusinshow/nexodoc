// A4 — F5 no meio. A leitura global demora 20s (`lento:20000`), e o F5 cai aos
// ~5s, com o POST já rodando no servidor. Esperado (catálogo): o palco
// reconecta sozinho, mostra o parecer quando termina, e o bilhete some.
// Memorial curto: a extração leva segundos, então aos 5s a linha "Audit" já
// existe e a leitura global ainda não voltou.
export default {
  id: "a4",
  area: "auditoria",
  titulo: "F5 no meio da auditoria: o palco reconecta e o bilhete some",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-global", "lento:20000");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await ctx.page.waitForTimeout(5000);

    const id = await ctx.conversaAberta();
    const bilheteAntes = (await ctx.lerConversa(id))?.auditoriaPendente ?? null;
    // Sem bilhete no disco antes do F5, a reconexão abaixo não provaria nada.
    ctx.verificar("o bilhete está no disco antes do F5", Boolean(bilheteAntes?.auditId), JSON.stringify(bilheteAntes));

    await ctx.page.reload({ waitUntil: "domcontentloaded" });

    const retomada = ctx.page.getByText("Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar.");
    await retomada.first().waitFor({ timeout: 60_000 }).catch(() => {});
    ctx.verificar("depois do F5 o palco diz que a análise segue no servidor, visível de verdade", await ctx.visivelRolando(retomada), `contagem=${await retomada.count()}`);

    const ver = await ctx.esperarParecer(1, 180_000);
    ctx.verificar("o parecer aparece sozinho, visível de verdade", (await ver.count()) === 1 && (await ctx.visivelRolando(ver)), `botões Ver o parecer=${await ver.count()}`);

    await ctx.page.waitForTimeout(1500);
    const depois = await ctx.lerConversa(id);
    ctx.verificar("o bilhete saiu do disco", !depois?.auditoriaPendente, JSON.stringify(depois?.auditoriaPendente));
    const pareceres = (depois?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar(
      "o parecer entrou no cartão do bilhete",
      pareceres.length === 1 && pareceres[0].artifactId === bilheteAntes?.artifactId,
      `pareceres=${pareceres.map((r) => r.artifactId).join(" | ")} bilhete=${bilheteAntes?.artifactId}`,
    );

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "uma auditoria, concluída no banco",
      registradas.length === 1 && linhas.length === 1 && linhas[0].status === "COMPLETED",
      `registradas=${registradas.length} ${JSON.stringify(linhas)}`,
    );
  },
};
