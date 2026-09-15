// A7 — com o parecer no palco, o engenheiro digita "audita o memorial".
// Esperado (catálogo): vai ao agente (não ao chat da auditoria) e aparece
// cartão. Em 14/09/2026 a mesma frase ia ao chat da auditoria e voltou duas
// vezes "Encaminhei a nova auditoria", sem cartão; a porta virou regra no
// cliente (`pedeNovaAuditoria`). A prova é pela rede: nenhuma chamada ao chat da
// auditoria, uma ao agente, e um cartão novo com "Auditar".
const RESPOSTA_DO_AGENTE = "Vou auditar o memorial (resposta simulada).";

export default {
  id: "a7",
  area: "auditoria",
  titulo:
    "pedir auditoria no chat com parecer aberto vai ao agente e abre cartão",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    const ver = await ctx.esperarParecer(1);
    await ver.last().click();
    await ctx.page.waitForTimeout(1500);

    // Não `exact: true`: a bolha traz um rótulo de acessibilidade colado no
    // mesmo elemento ("Nexo: ", `NexoChat.tsx:1128`, `<span className="sr-only">`),
    // então o texto INTEIRO da bolha é "Nexo: Vou auditar o memorial (resposta
    // simulada)." — a igualdade exata nunca bate, e a jornada esperava a
    // resposta pelos 60s inteiros achando 0 sempre (medido em 15/09/2026 com
    // `page.evaluate` despejando o texto real da bolha). Substring pega a
    // resposta pronta sem depender do rótulo.
    const respostas = ctx.page.getByText(RESPOSTA_DO_AGENTE);
    const respostasAntes = await respostas.count();
    const botoesAuditarAntes = await ctx.page
      .getByRole("button", { name: /^Auditar$/ })
      .count();
    ctx.verificar(
      "antes do pedido não há cartão esperando auditoria",
      botoesAuditarAntes === 0,
      `botões Auditar=${botoesAuditarAntes}`,
    );

    const chatDaAuditoria = ctx.contarRequisicoes(
      (req) => new URL(req.url()).pathname === "/api/audit/chat",
    );
    const agente = ctx.contarRequisicoes(
      (req) => new URL(req.url()).pathname === "/api/nexo/agent",
    );
    await ctx.escrever("audita o memorial");

    const respondeu = await ctx.esperar(
      async () => (await respostas.count()) > respostasAntes,
      60_000,
    );
    const auditar = ctx.page.getByRole("button", { name: /^Auditar$/ });
    await auditar
      .first()
      .waitFor({ timeout: 120_000 })
      .catch(() => {});
    chatDaAuditoria.parar();
    agente.parar();

    ctx.verificar(
      "o agente respondeu com a proposta",
      respondeu,
      `respostas antes=${respostasAntes} depois=${await respostas.count()}`,
    );
    ctx.verificar(
      "o pedido foi ao agente",
      agente.total() >= 1,
      `chamadas ao agente=${agente.total()}`,
    );
    // P5: "chat da auditoria=0" sozinho não prova nada — uma jornada que nunca
    // mandasse a mensagem para lugar nenhum também daria 0. Amarrar ao agente
    // (>=1) é o que torna a ausência não vazia: ela só conta porque o pedido de
    // fato saiu, e saiu pela porta certa.
    ctx.verificar(
      "nada foi ao chat da auditoria, e o pedido saiu pela porta certa (o agente)",
      chatDaAuditoria.total() === 0 && agente.total() >= 1,
      `chat da auditoria=${chatDaAuditoria.total()} agente=${agente.total()}`,
    );
    const qtdAuditar = await auditar.count();
    ctx.verificar(
      "um cartão novo com Auditar, visível de verdade",
      qtdAuditar === 1 && (await ctx.visivelRolando(auditar)),
      `botões Auditar=${qtdAuditar}`,
    );
  },
};
