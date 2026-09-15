// A6 — memorial com uma folha só de desenho. Esperado (catálogo): o botão diz
// "Conferindo páginas…" e depois "Transcrever e auditar"; depois de
// transcrever, o parecer sai sem aviso de páginas.
//
// "Conferindo páginas…" dura o diagnóstico de um PDF de quatro páginas — pouco
// para um `waitFor` depois do fato. O `vigiar` fica na página antes do gesto e
// anota se o texto passou pela tela.
export default {
  id: "a6",
  area: "auditoria",
  titulo:
    "folhas mudas: o cartão confere, transcreve e o parecer sai sem aviso de páginas",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.vigiar("conferindo", "Conferindo páginas…");

    await ctx.abrirCartaoDeAuditoria(f.memorialComFolhaMuda);
    const transcrever = await ctx.esperarBotao(
      /^Transcrever e auditar$/,
      120_000,
    );

    ctx.verificar(
      "o botão passou por 'Conferindo páginas…' antes de liberar",
      await ctx.viu("conferindo"),
    );
    const tituloDoPortao = ctx.page.getByText("Páginas sem texto", {
      exact: true,
    });
    // O número mora num <span> dentro do <p>: o <p> é o menor elemento com a frase inteira.
    const frase = ctx.page.getByText(/páginas deste documento não têm texto/);
    const textoDaFrase =
      (await frase.count()) > 0 ? await frase.first().innerText() : "";
    ctx.verificar(
      "o portão diz quantas folhas estão mudas, visível de verdade",
      (await ctx.visivelRolando(tituloDoPortao)) && /1 de 4/.test(textoDaFrase),
      `título=${await tituloDoPortao.count()} frase=${JSON.stringify(textoDaFrase.slice(0, 80))}`,
    );
    // P5: isEnabled sozinho não prova que o botão está na tela — só que o DOM
    // não o desabilitou. visivelRolando fecha a lacuna (elemento fora da dobra
    // ou escondido passaria em isEnabled sem nunca ter sido clicável de fato).
    const habilitado = await transcrever.isEnabled();
    const visivel = await ctx.visivelRolando(transcrever);
    ctx.verificar(
      "'Transcrever e auditar' habilitado e visível de verdade",
      habilitado && visivel,
      `habilitado=${habilitado} visível=${visivel}`,
    );

    const transcricoes = ctx.contarRequisicoes(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/audit/transcrever-pagina",
    );
    await transcrever.click();
    const ver = await ctx.esperarParecer(1);
    transcricoes.parar();
    ctx.verificar(
      "uma folha foi mandada para transcrição",
      transcricoes.total() === 1,
      `transcrições=${transcricoes.total()}`,
    );

    await ver.last().click();
    await ctx.page.waitForTimeout(1500);
    const recuperadas = ctx.page.getByText(
      /páginas sem texto recuperadas por visão/,
    );
    const parecerVisivel = await ctx.visivelRolando(recuperadas);
    ctx.verificar(
      "o parecer conta a folha recuperada por visão, visível de verdade",
      parecerVisivel,
      `contagem=${await recuperadas.count()}`,
    );

    // P5: contagem 0 sozinha não prova nada — um parecer que nunca renderizou
    // também dá 0. Amarrar ao parecer visível acima é o que torna a ausência
    // do aviso não vazia: ela só conta porque há relatório na tela para não o ter.
    const contagemDoAviso = await ctx.page
      .getByText(/PÁGINA NÃO FOI LIDA|PÁGINAS NÃO FORAM LIDAS/)
      .count();
    ctx.verificar(
      "nenhum aviso de página não lida, com o parecer de fato na tela",
      contagemDoAviso === 0 && parecerVisivel,
      `contagem=${contagemDoAviso} parecerVisível=${parecerVisivel}`,
    );

    const id = await ctx.conversaAberta();
    const parecer = ((await ctx.lerConversa(id))?.results ?? []).filter(
      (r) => r.kind === "auditoria",
    );
    const cobertura =
      parecer[0]?.payload?.report?.arquivos_analisados?.[0]?.cobertura;
    ctx.verificar(
      "o parecer gravado registra uma página transcrita",
      parecer.length === 1 && cobertura?.paginas_transcritas === 1,
      JSON.stringify(cobertura),
    );

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "uma auditoria, concluída no banco",
      registradas.length === 1 &&
        linhas.length === 1 &&
        linhas[0].status === "COMPLETED",
      JSON.stringify(linhas),
    );
  },
};
