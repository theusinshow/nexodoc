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
    // O memorial junto das pranchas também é classificado (NexoWorkspace.tsx:1393-1397,
    // `classifyMemorial` → `POST /api/nexo/classify`) — uma vez só, pelo lote inteiro.
    const classificacoesDoMemorial = ctx.contarRequisicoes(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/nexo/classify",
    );
    await ctx.anexar([f.memorialCurto, ...f.pranchas]);
    await ctx.esperarTexto(/Anexei 3 folhas/, 180_000);
    /*
     * O recibo aparece no DOM assim que `appendMessage` roda, mas a gravação em
     * disco (e `nexo:ultima-conversa`) é debounced (500ms, `PERSIST_DEBOUNCE_MS`
     * em conversation-store.tsx) — ler o id UMA VEZ logo depois do texto pegava
     * `null` e o poll inteiro ficava preso em `lerConversa(null)` (medido em
     * 15/09/2026). Por isso o id é relido a CADA volta do `ctx.esperar`, e não
     * antes dele: se a gravação atrasar mais que o comum, a próxima volta pega
     * o id assim que ele existir, em vez de travar 30s num valor congelado.
     */
    let id = null;
    const conversaPronta = await ctx.esperar(async () => {
      id = await ctx.conversaAberta();
      if (!id) return false;
      const c = await ctx.lerConversa(id);
      return (c?.seloResults?.length ?? 0) === 3 && Boolean(c?.memorial);
    }, 30_000);
    leiturasDeSelo.parar();
    /*
     * A classificação do memorial (`classifyMemorial`, NexoWorkspace.tsx:1393-1397)
     * roda DEPOIS de `appendSelosIntake` — que é o que faz `seloResults` chegar a
     * 3 no disco — então o contador só é parado depois das checagens de tela lá
     * embaixo: elas dão o tempo real de que a chamada, já em voo, precisa para
     * voltar, sem um `waitForTimeout` só para isto.
     */
    ctx.verificar(
      "a conversa gravada apareceu com o memorial e as três leituras de selo",
      conversaPronta,
      `id=${id}`,
    );
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
    // As fixtures são determinísticas: o ARQUIVO do carimbo de cada prancha é o
    // próprio nome do arquivo sem ".pdf" (`pranchaBytes`, fixtures.mjs:139-144).
    // Checar só a presença (`Boolean(extraction?.arquivo)`) deixaria passar um
    // carimbo lido e colado na folha errada — aqui o valor é comparado folha a
    // folha, e o detalhe lista só quem não bate.
    const carimbos = (conversa?.seloResults ?? []).map((r) => ({
      fileName: r.fileName,
      esperado: r.fileName?.replace(/\.pdf$/, "") ?? null,
      lido: r.extraction?.arquivo ?? null,
    }));
    const carimbosErrados = carimbos.filter((c) => c.lido !== c.esperado);
    ctx.verificar(
      "as três pranchas voltaram com o carimbo da própria folha",
      carimbos.length === 3 && carimbosErrados.length === 0,
      JSON.stringify(carimbosErrados),
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

    classificacoesDoMemorial.parar();
    ctx.verificar(
      "uma classificação só, pelo lote inteiro",
      classificacoesDoMemorial.total() === 1,
      `classificações=${classificacoesDoMemorial.total()}`,
    );
  },
};
