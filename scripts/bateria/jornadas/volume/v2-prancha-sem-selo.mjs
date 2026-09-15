// V2 — um lote com uma prancha legível e uma cujo carimbo não tem texto. A
// leitura da segunda VOLTA, e volta vazia (decisão V2 no desenho). Esperado
// (catálogo): a prancha aparece como não lida, e não some do volume.
//
// "Não some": a folha continua nos selos da conversa e no recibo "Anexei 2
// folhas" — é dela que a LD e o volume saem (`r.extraction ?? seloNaoLido()`).
import path from "node:path";

export default {
  id: "v2",
  area: "volume",
  titulo: "prancha sem selo legível aparece como não lida e não some do volume",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const legivel = path.basename(f.pranchas[0]);
    const semSelo = path.basename(f.pranchaSemSelo);

    const leituras = ctx.contarRequisicoes(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/ld/extract-stamp",
    );
    await ctx.anexar([f.pranchas[0], f.pranchaSemSelo]);
    await ctx.esperarTexto(/Anexei 2 folhas/, 180_000);

    /*
     * Lição da c2 (15/09/2026, c2-memorial-e-pranchas.mjs): o recibo chega ao
     * DOM antes de `nexo:ultima-conversa` e do disco terminarem de gravar
     * (debounce de 500ms, `PERSIST_DEBOUNCE_MS` em conversation-store.tsx). Um
     * `waitForTimeout` fixo seguido de UMA leitura arrisca pegar `id` nulo ou a
     * conversa ainda com menos de duas folhas — por isso `conversaAberta()` é
     * relido A CADA volta do `ctx.esperar`, até as duas leituras aparecerem
     * gravadas, e não uma vez só depois de uma espera fixa.
     */
    let id = null;
    const conversaPronta = await ctx.esperar(async () => {
      id = await ctx.conversaAberta();
      if (!id) return false;
      const c = await ctx.lerConversa(id);
      return (c?.seloResults?.length ?? 0) === 2;
    }, 30_000);
    leituras.parar();
    // Sem isto, "não lida" poderia ser "pulada como capa", que é outro caso.
    ctx.verificar(
      "as duas folhas foram ao leitor de selo, inclusive a sem carimbo",
      leituras.total() === 2,
      `leituras=${leituras.total()}`,
    );
    ctx.verificar(
      "a conversa gravada apareceu com as duas leituras de selo",
      conversaPronta,
      `id=${id}`,
    );

    const conversa = await ctx.lerConversa(id);
    const folhas = conversa?.seloResults ?? [];
    const daLegivel = folhas.find((r) => r.fileName === legivel);
    const daSemSelo = folhas.find((r) => r.fileName === semSelo);
    ctx.verificar(
      "as duas folhas continuam na conversa",
      folhas.length === 2 && Boolean(daLegivel) && Boolean(daSemSelo),
      JSON.stringify(folhas.map((r) => r.fileName)),
    );
    ctx.verificar(
      "a prancha legível foi lida",
      Boolean(daLegivel?.extraction?.arquivo),
      JSON.stringify(daLegivel?.extraction),
    );
    ctx.verificar(
      "a prancha sem selo ficou como não lida (nem lida, nem pulada)",
      Boolean(daSemSelo) && !daSemSelo.extraction && !daSemSelo.ignorada,
      JSON.stringify({
        extraction: daSemSelo?.extraction,
        ignorada: daSemSelo?.ignorada,
        error: daSemSelo?.error,
      }),
    );

    const chip = ctx.page.getByText("selo ilegível", { exact: true });
    ctx.verificar(
      "o chip da prancha sem selo diz 'selo ilegível', visível de verdade",
      (await chip.count()) === 1 && (await ctx.visivelRolando(chip)),
      `contagem=${await chip.count()}`,
    );
    const ressalva = ctx.page.getByText(/1 folha não deu para ler/);
    const textoDaRessalva =
      (await ressalva.count()) > 0 ? await ressalva.first().innerText() : "";
    ctx.verificar(
      "a conversa diz qual folha não deu para ler, visível de verdade",
      textoDaRessalva.includes(semSelo) && (await ctx.visivelRolando(ressalva)),
      JSON.stringify(textoDaRessalva.slice(0, 160)),
    );
  },
};
