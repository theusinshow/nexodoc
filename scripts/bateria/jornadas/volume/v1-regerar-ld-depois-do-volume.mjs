// V1 — regerar a LD depois de o volume estar montado. Esperado (catálogo):
// volume marcado como envelhecido; remontar resolve.
//
// 1. anexa duas pranchas (leitura de selo simulada) e pede a LD pelo chat;
// 2. gera a LD no plano;
// 3. grava no disco um volume montado com ESSA LD e reabre (ver a decisão V1 no
//    desenho: a montagem real depende de LibreOffice);
// 4. reanexa as pranchas — os bytes voltam, e nenhuma folha é relida;
// 5. regera a LD pelo mesmo plano, que é o gesto do catálogo;
// 6. confere o aviso, o motivo e o botão de remontar.
import path from "node:path";

export default {
  id: "v1",
  area: "volume",
  titulo:
    "regerar a LD depois do volume montado marca o volume como desatualizado",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    const duas = f.pranchas.slice(0, 2);
    const leituraDeSelo = (req) =>
      req.method() === "POST" &&
      new URL(req.url()).pathname === "/api/ld/extract-stamp";

    await ctx.anexar(duas);
    await ctx.esperarTexto(/Anexei 2 folhas/, 180_000);
    await ctx.escrever("cria a LD dessas pranchas com o título BATERIA V1");
    await (await ctx.esperarBotao(/^Gerar os 1$/, 120_000)).click();
    await ctx.esperarBotao(/^Gerar de novo$/, 120_000);
    await page.waitForTimeout(1500);

    const id = await ctx.conversaAberta();
    const conversa = await ctx.lerConversa(id);
    const ld = (conversa?.results ?? []).find((r) => r.kind === "ld");
    ctx.verificar(
      "a LD foi gerada e gravada com hora",
      typeof ld?.generatedAt === "number",
      JSON.stringify(
        (conversa?.results ?? []).map((r) => [r.artifactId, r.generatedAt]),
      ),
    );
    if (!ld) return;

    // `volumeId(selos)` é `volume:<código>`, e `ldId(selos)` é `ld:<código>:<revisão>` (ConfirmationCard).
    const volumeId = `volume:${ld.artifactId.split(":")[1]}`;
    const agora = Date.now();
    await ctx.indexeddb.gravarConversa({
      ...conversa,
      updatedAt: agora,
      messages: [
        ...conversa.messages,
        {
          id: `bateria-v1-volume-${agora}`,
          role: "assistant",
          content: "Volume montado.",
          proposals: [{ kind: "volume", resumo: "Volume", params: {} }],
        },
      ],
      results: [
        ...conversa.results,
        {
          artifactId: volumeId,
          kind: "volume",
          summary: "Volume montado",
          canvas: { label: "Volume", pageNumber: 1 },
          payload: {
            tomo: ld.payload?.tomo ?? 1,
            folhas: ld.payload?.folhas ?? "",
            partes: [{ id: ld.artifactId, em: ld.generatedAt }],
            conferencia: null,
          },
          generatedAt: ld.generatedAt + 1000,
          files: [],
        },
      ],
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const aviso = page.getByText("Volume desatualizado", { exact: true });
    const volumeNoDisco = ((await ctx.lerConversa(id))?.results ?? []).some(
      (r) => r.artifactId === volumeId,
    );
    // Controle: com a mesma LD de dentro do volume, o aviso não pode existir.
    ctx.verificar(
      "volume com a LD atual: nenhum aviso",
      volumeNoDisco && (await aviso.count()) === 0,
      `volume no disco=${volumeNoDisco} avisos=${await aviso.count()}`,
    );

    const leituras = ctx.contarRequisicoes(leituraDeSelo);
    await ctx.anexar(duas);
    // P5 (bifurcação do controlador, 15/09/2026): o `esperar` diz se o reanexo
    // ACONTECEU — sem ele, "0 leituras" passa igual quando o reanexo nunca
    // rodou. E "sem reler" só prova algo se as DUAS pranchas certas — pelo
    // nome, não pela contagem — estiverem de volta na conversa.
    const reanexou = await ctx.esperar(
      async () => (await page.getByText(/Anexei 2 folhas/).count()) >= 2,
      60_000,
    );
    await page.waitForTimeout(1500);
    leituras.parar();
    const nomesDasDuas = duas.map((c) => path.basename(c));
    const folhasDeVolta = (
      (await ctx.lerConversa(id))?.seloResults ?? []
    ).filter((r) => nomesDasDuas.includes(r.fileName));
    ctx.verificar(
      "reanexar trouxe as pranchas sem reler nenhuma folha",
      reanexou && folhasDeVolta.length === 2 && leituras.total() === 0,
      `reanexou=${reanexou} pranchas de volta=${JSON.stringify(folhasDeVolta.map((r) => r.fileName))} leituras de selo=${leituras.total()}`,
    );

    const antes = ld.generatedAt;
    await (
      await ctx.esperarBotao(/^(Gerar de novo|Atualizar 1 documento)$/, 60_000)
    ).click();
    const regerou = await ctx.esperar(async () => {
      const atual = ((await ctx.lerConversa(id))?.results ?? []).find(
        (r) => r.artifactId === ld.artifactId,
      );
      return (atual?.generatedAt ?? 0) > antes;
    }, 120_000);
    ctx.verificar("a LD foi gerada de novo", regerou);

    await aviso
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    ctx.verificar(
      "o volume aparece como desatualizado, visível de verdade",
      (await aviso.count()) === 1 && (await ctx.visivelRolando(aviso)),
      `avisos=${await aviso.count()}`,
    );
    const motivo = page.getByText(/foi gerada de novo depois deste volume/);
    ctx.verificar(
      "o motivo nomeia a LD regerada, visível de verdade",
      await ctx.visivelRolando(motivo),
      `contagem=${await motivo.count()}`,
    );
    const remontar = page.getByRole("button", { name: /^Remontar e baixar$/ });
    ctx.verificar(
      "remontar é oferecido, visível de verdade",
      (await remontar.count()) === 1 && (await ctx.visivelRolando(remontar)),
      `botões=${await remontar.count()}`,
    );
  },
};
