// C8 — conversa cujos arquivos gerados estão em OUTRA máquina: o registro tem
// as referências (`files` com `blobKey`), mas os bytes não estão neste navegador.
//
// DEFEITO PEGO EM 10/10/2026 (prova do tour do volume): ao abrir, a
// reidratação descartava a referência de todo arquivo sem blob local, e a
// gravação seguinte — qualquer uma — mandava o resultado sem ela ao disco e ao
// servidor. A conversa EST do 084-25 ficou com zero arquivos em seis volumes e
// seis LDs, e a máquina que tinha os bytes perdeu o caminho até eles.
//
// Gesto: abrir a conversa pela barra, dizer algo (grava) e trocar para outra
// (grava a que sai). A referência tem de continuar no disco, e a tela, dizer que o arquivo
// não está aqui.

function comArquivoAusente({ id, titulo, agora }) {
  return {
    id,
    title: titulo,
    createdAt: agora - 3_600_000,
    updatedAt: agora,
    seloResults: [],
    messages: [
      { id: "u1", role: "user", content: "gera a LD" },
      { id: "a1", role: "assistant", content: "Gerei a LD." },
    ],
    results: [
      {
        artifactId: "ld:900-26:a",
        kind: "ld",
        summary: "LD 900-26",
        files: [
          { label: "ODT", name: "900-26_ld_a.odt", mime: "application/vnd.oasis.opendocument.text", blobKey: `${id}:ld:900-26:a:ODT`, sizeBytes: 12_345 },
          { label: "PDF", name: "900-26_ld_a.pdf", mime: "application/pdf", blobKey: `${id}:ld:900-26:a:PDF`, primary: true, sizeBytes: 23_456 },
        ],
        generatedAt: agora - 1_800_000,
      },
    ],
  };
}

export default {
  id: "c8",
  area: "conversas",
  titulo: "abrir conversa com os arquivos em outra máquina não apaga as referências deles",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const agora = Date.now();
    const idA = `bateria-c8-a-${agora}`;
    const idB = `bateria-c8-b-${agora}`;
    await ctx.indexeddb.gravarConversa(comArquivoAusente({ id: idA, titulo: "BATERIA C8 A", agora }));
    await ctx.indexeddb.gravarConversa({
      id: idB,
      title: "BATERIA C8 B",
      createdAt: agora - 7_200_000,
      // Recente: com as conversas das outras jornadas, uma antiga cai em "Mais N conversas".
      updatedAt: agora + 1,
      seloResults: [],
      messages: [{ id: "u1", role: "user", content: "oi" }],
      results: [],
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await ctx.abrirConversa("BATERIA C8 A");
    await page.waitForTimeout(1500);
    // Uma gravação de verdade: uma fala. "audita o memorial" tem resposta fixa
    // da rota do agente, sem modelo (`ehOPedidoDoBotao`); sem memorial na
    // conversa, ela pede o arquivo.
    const campo = page.locator("textarea").first();
    await campo.fill("audita o memorial");
    await campo.press("Enter");
    await ctx.esperarTexto(/Anexe as pranchas|Leio o memorial/, 30_000);
    await page.waitForTimeout(1500);
    // A troca grava a conversa que sai.
    await ctx.abrirConversa("BATERIA C8 B");
    await page.waitForTimeout(2000);

    const rec = (await ctx.indexeddb.lerConversas()).find((c) => c.id === idA);
    const arquivos = rec?.results?.[0]?.files ?? [];
    ctx.verificar(
      "as duas referências continuam no disco depois da troca",
      arquivos.length === 2 && arquivos.every((f) => f.blobKey.startsWith(`${idA}:ld:900-26:a:`)),
      JSON.stringify(arquivos.map((f) => f.blobKey)),
    );
    ctx.verificar(
      "e com o que a outra máquina precisa para achá-las (nome, tipo, principal)",
      arquivos.some((f) => f.label === "PDF" && f.primary && f.name === "900-26_ld_a.pdf"),
      JSON.stringify(arquivos),
    );
  },
};
