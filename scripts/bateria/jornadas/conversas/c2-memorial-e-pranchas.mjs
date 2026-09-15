// C2 — memorial e três pranchas soltos juntos. Esperado (catálogo): o memorial
// vira memorial, as pranchas vão à leitura de selo, e nenhuma prancha é lida
// como memorial. A contagem de chamadas ao leitor de selo é o que prova que o
// memorial não foi para o OCR: três pranchas de uma página, três chamadas.
import path from "node:path";

export default {
  id: "c2",
  area: "conversas",
  titulo: "memorial e pranchas no mesmo drop: cada um no seu fluxo",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const nomeDoMemorial = path.basename(f.memorialCurto);
    const nomesDasPranchas = f.pranchas.map((p) => path.basename(p)).sort();

    const leiturasDeSelo = ctx.contarRequisicoes(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/ld/extract-stamp",
    );
    await ctx.anexar([f.memorialCurto, ...f.pranchas]);
    await ctx.esperarTexto(/Anexei 3 folhas/, 180_000);
    // O recibo aparece no DOM assim que `appendMessage` roda, mas a gravação em
    // disco (e `nexo:ultima-conversa`) é debounced (500ms, `PERSIST_DEBOUNCE_MS`
    // em conversation-store.tsx) — ler o id logo depois do texto pegava `null`
    // (medido em 15/09/2026). c1 e c6 passam da mesma janela antes de confiar em
    // localStorage/IndexedDB; aqui é a mesma espera.
    await ctx.page.waitForTimeout(1500);

    const id = await ctx.conversaAberta();
    await ctx.esperar(async () => {
      const c = await ctx.lerConversa(id);
      return (c?.seloResults?.length ?? 0) === 3 && Boolean(c?.memorial);
    }, 30_000);
    leiturasDeSelo.parar();
    const conversa = await ctx.lerConversa(id);

    ctx.verificar(
      "três leituras de selo, uma por prancha",
      leiturasDeSelo.total() === 3,
      `leituras=${leiturasDeSelo.total()}`,
    );
    ctx.verificar(
      "o memorial ficou retido como memorial",
      conversa?.memorial?.name === nomeDoMemorial,
      JSON.stringify(conversa?.memorial),
    );
    const lidas = (conversa?.seloResults ?? []).map((r) => r.fileName).sort();
    ctx.verificar(
      "as folhas lidas são as três pranchas",
      JSON.stringify(lidas) === JSON.stringify(nomesDasPranchas),
      JSON.stringify(lidas),
    );
    ctx.verificar(
      "nenhuma folha lida é o memorial",
      !lidas.includes(nomeDoMemorial),
      JSON.stringify(lidas),
    );
    ctx.verificar(
      "as três pranchas voltaram com carimbo lido",
      (conversa?.seloResults ?? []).length === 3 &&
        conversa.seloResults.every((r) => r.extraction?.arquivo),
      JSON.stringify(
        (conversa?.seloResults ?? []).map((r) => r.extraction?.arquivo ?? null),
      ),
    );

    const recibo = ctx.page.getByText(/Anexei 3 folhas/);
    ctx.verificar(
      "o recibo das pranchas, visível de verdade",
      await ctx.visivelRolando(recibo),
      `contagem=${await recibo.count()}`,
    );

    // P5 (Controller, 15/09/2026): contar não basta — um só chip existir no DOM
    // sem entrar na dobra ainda passaria em `count() === 1`. `visivelRolando`
    // prova que a oferta chegou aos olhos de quem lê a tela, não só ao DOM.
    const trocarMemorial = ctx.page.getByRole("button", {
      name: /^tratar como prancha$/,
    });
    const trocarMemorialContagem = await trocarMemorial.count();
    ctx.verificar(
      "só o memorial se oferece para virar prancha, visível de verdade",
      trocarMemorialContagem === 1 &&
        (await ctx.visivelRolando(trocarMemorial)),
      `contagem=${trocarMemorialContagem}`,
    );

    const auditar = ctx.page.getByRole("button", {
      name: /Auditar o memorial/,
    });
    ctx.verificar(
      "com memorial no lote, auditar é oferecido, visível de verdade",
      await ctx.visivelRolando(auditar),
      `contagem=${await auditar.count()}`,
    );
  },
};
