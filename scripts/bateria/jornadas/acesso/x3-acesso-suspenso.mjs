// X3 — o acesso é suspenso no meio da retomada de uma auditoria (403). A tela
// não pode ficar em "análise em curso" para sempre: diz o motivo, para de
// perguntar e deixa descartar a espera.
//
// O caminho é o da x1, com 403 no lugar do 401: auditar com leitura global de
// 30s, F5 com acesso (o palco retoma e pergunta por GET /api/audits/<id>), e
// então desativar o membro no banco. Quem recarrega sem acesso cai em
// /sem-acesso (app/nexo/page.tsx); o que sobra para a tela é a aba que já
// estava perguntando.
const EMAIL = "bateria@nexodoc.local";

export default {
  id: "x3",
  area: "acesso",
  titulo:
    "acesso suspenso no meio da retomada: a tela diz o motivo, para de perguntar e deixa descartar",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-global", "lento:30000");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    const id = await ctx.conversaAberta();
    await ctx.esperar(
      async () =>
        Boolean((await ctx.lerConversa(id))?.auditoriaPendente?.auditId),
      15_000,
      250,
    );
    const bilhete = (await ctx.lerConversa(id))?.auditoriaPendente ?? null;
    ctx.verificar(
      "o bilhete está no disco antes do F5",
      Boolean(bilhete?.auditId),
      JSON.stringify(bilhete),
    );
    if (!bilhete?.auditId) return;

    const daAuditoria = (req) =>
      new URL(req.url()).pathname === `/api/audits/${bilhete.auditId}`;
    const perguntasComAcesso = ctx.contarRequisicoes(daAuditoria);
    await page.reload({ waitUntil: "domcontentloaded" });
    const retomada = page.getByText(
      "Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar.",
    );
    const retomou = await ctx.esperar(
      async () => (await retomada.count()) > 0,
      60_000,
      500,
    );
    await ctx.esperar(() => perguntasComAcesso.total() > 0, 8_000);
    const perguntasAntes = perguntasComAcesso.total();
    perguntasComAcesso.parar();
    ctx.verificar(
      "com acesso, o palco retomou e estava perguntando",
      retomou && perguntasAntes > 0 && (await ctx.visivelRolando(retomada)),
      `retomada=${await retomada.count()} perguntas=${perguntasAntes}`,
    );

    try {
      await ctx.banco.consultar(
        `update "OrganizationMember" set status = 'DISABLED' where email = $1`,
        [EMAIL],
      );

      const motivo = page.getByText("Você não faz parte de nenhum escritório.");
      const disse = await ctx.esperar(
        async () => (await motivo.count()) > 0,
        20_000,
        500,
      );
      const motivoVisivel = disse && (await ctx.visivelRolando(motivo));
      const retomadaSumiu = (await retomada.count()) === 0;
      ctx.verificar(
        "sem acesso, a tela diz o motivo e sai de 'análise em curso', visível de verdade",
        motivoVisivel && retomadaSumiu,
        `motivo=${await motivo.count()} retomada=${await retomada.count()}`,
      );

      // A tela parou de perguntar: nenhuma pergunta nova numa janela maior que
      // o intervalo de 5s, contada só depois de o motivo aparecer.
      const perguntasDepois = ctx.contarRequisicoes(daAuditoria);
      await page.waitForTimeout(12_000);
      perguntasDepois.parar();
      ctx.verificar(
        "sem acesso, a tela para de perguntar",
        motivoVisivel && perguntasDepois.total() === 0,
        `motivo=${motivoVisivel} perguntas em 12s=${perguntasDepois.total()}`,
      );

      const descartar = page.getByRole("button", {
        name: "Descartar esta espera",
      });
      const podeDescartar =
        (await descartar.count()) === 1 &&
        (await ctx.visivelRolando(descartar));
      ctx.verificar(
        "a espera pode ser descartada, visível de verdade",
        podeDescartar,
        `botões=${await descartar.count()}`,
      );
      if (podeDescartar) {
        await descartar.click();
        const saiu = await ctx.esperar(
          async () => !(await ctx.lerConversa(id))?.auditoriaPendente,
          10_000,
          250,
        );
        ctx.verificar(
          "descartar tira o bilhete do disco e a caixa do motivo some",
          saiu && (await motivo.count()) === 0,
          `bilhete=${JSON.stringify((await ctx.lerConversa(id))?.auditoriaPendente)} motivo=${await motivo.count()}`,
        );
      }
    } finally {
      // O banco não é esvaziado entre jornadas: o acesso volta, senão todas as
      // seguintes cairiam em /sem-acesso.
      await ctx.banco.consultar(
        `update "OrganizationMember" set status = 'ACTIVE' where email = $1`,
        [EMAIL],
      );
      /*
       * E NADA DESTA JORNADA SOBRA PARA A SEGUINTE (15/09/2026, duas rodadas
       * completas vermelhas). A auditoria de 30s segue no servidor depois do
       * descarte: na rodada 1 a validação dela consumiu o "truncar" que a a2
       * tinha enfileirado. E o descarte do bilhete não chega ao servidor (a
       * gravação recebe 403): a a1, logada como o mesmo usuário, recebia esta
       * conversa com bilhete na lista e a retomada a abria. Espera a auditoria
       * terminar e tira o bilhete da cópia do servidor.
       */
      await ctx.esperar(
        async () => {
          const [linha] = await ctx.banco.consultar(
            `select status from "Audit" where id = $1`,
            [bilhete.auditId],
          );
          return linha?.status === "COMPLETED" || linha?.status === "FAILED";
        },
        90_000,
        1000,
      );
      await ctx.banco.consultar(
        `update "NexoConversation" set "auditoriaPendente" = false, data = data - 'auditoriaPendente' where id = $1`,
        [id],
      );
    }
  },
};
