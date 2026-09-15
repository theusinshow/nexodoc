// C4 — conversa gravada antes de a486a53, com o parecer em `auditoria:117-25`.
// Ao abrir, a migração tem de entregar o parecer à ÚLTIMA proposta e a rodada
// sobrescrita à anterior (modules/nexo/lib/auditoria-da-proposta.ts).
import fs from "node:fs";

const fixture = JSON.parse(fs.readFileSync("scripts/bateria/fixtures/parecer-117-25-incompleto.json", "utf8"));

export default {
  id: "c4",
  area: "conversas",
  titulo: "conversa antiga abre com o parecer no cartão certo",
  async rodar(ctx) {
    await ctx.login();
    const agora = Date.now();
    const id = `bateria-c4-${agora}`;
    await ctx.indexeddb.gravarConversa({
      id,
      title: "BATERIA C4 CONVERSA ANTIGA",
      createdAt: agora - 3_600_000,
      updatedAt: agora,
      seloResults: [],
      messages: [
        { id: "u1", role: "user", content: "Anexei o memorial — 117_25_md_geral_a.pdf" },
        { id: "p1", role: "assistant", content: "Vou auditar o memorial.", proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] },
        { id: "u2", role: "user", content: "audita o memorial" },
        { id: "p2", role: "assistant", content: "Vou auditar de novo.", proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] },
      ],
      results: [{ ...fixture.resultado, generatedAt: agora - 60_000 }],
      auditorias: [
        { auditId: "rodada-sobrescrita", artifactId: "auditoria:117-25" },
        { auditId: fixture.resultado.payload.auditId, artifactId: "auditoria:117-25" },
      ],
    });

    await ctx.abrirConversa("BATERIA C4 CONVERSA ANTIGA");

    /*
     * ESPERA POR EVENTO, NÃO POR RELÓGIO (15/09/2026). `abrirConversa` dá 2,5s
     * depois do clique, e desde que a abertura espera a lista do servidor (até
     * 4s) isso deixou de bastar: numa rodada da área conversas o botão "Auditar
     * de novo" ainda não existia quando a verificação olhou. Espera a conversa
     * aberta ser esta, a migração gravada no disco e o botão na tela.
     */
    const deNovo = ctx.page.getByRole("button", { name: /auditar de novo/i });
    const pronta = await ctx.esperar(async () => {
      if ((await ctx.conversaAberta()) !== id) return false;
      const r = (await ctx.indexeddb.lerConversas()).find((c) => c.id === id);
      if (r?.results?.[0]?.artifactId !== "auditoria:117-25:p2") return false;
      return (await deNovo.count()) > 0;
    }, 20_000, 500);
    ctx.verificar("a conversa abriu e migrou em até 20s", pronta, `aberta=${await ctx.conversaAberta()}`);

    const rec = (await ctx.indexeddb.lerConversas()).find((c) => c.id === id);
    ctx.verificar("parecer migrou para a última proposta", rec?.results?.[0]?.artifactId === "auditoria:117-25:p2", rec?.results?.[0]?.artifactId);
    ctx.verificar(
      "rodada sobrescrita desceu para a proposta anterior",
      rec?.auditorias?.find((a) => a.auditId === "rodada-sobrescrita")?.artifactId === "auditoria:117-25:p1",
      JSON.stringify(rec?.auditorias),
    );

    // Presença no DOM não basta: card fora da dobra ou escondido atrás de outro
    // passaria em `count()` sem nunca ter chegado aos olhos de quem lê a tela.
    const qtdDeNovo = await deNovo.count();
    ctx.verificar(
      "um único botão de auditar de novo, visível de verdade",
      qtdDeNovo === 1 && (await ctx.visivelRolando(deNovo)),
      `contagem=${qtdDeNovo}`,
    );

    const aviso = ctx.page.getByText(/14 PÁGINAS NÃO FORAM LIDAS/);
    ctx.verificar(
      "o aviso diz quantas páginas não foram lidas, visível de verdade",
      await ctx.visivelRolando(aviso),
      `contagem=${await aviso.count()}`,
    );

    const contagem = ctx.page.getByText(/contagem INCOMPLETA/);
    ctx.verificar(
      "a contagem não aparece sozinha, visível de verdade",
      await ctx.visivelRolando(contagem),
      `contagem=${await contagem.count()}`,
    );
  },
};
