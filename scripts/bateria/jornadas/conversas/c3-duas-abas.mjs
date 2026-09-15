// C3 — a aba 1 audita; a aba 2 abriu a mesma conversa antes e ficou parada; a
// aba 2 grava depois. Decidido pelo Matheus em 15/09/2026: a aba desatualizada
// é recusada, avisa e oferece recarregar, sem sobrescrever.
//
// Duas abas são duas páginas do MESMO contexto: mesmos cookies, mesmo
// IndexedDB, mesmo `nexo:ultima-conversa` — é assim que a aba 2 abre a mesma
// conversa sozinha. A rota também é exercitada direto, com uma base velha: é o
// caminho de outra máquina, que o IndexedDB desta não protege.
export default {
  id: "c3",
  area: "conversas",
  titulo: "duas abas na mesma conversa: a aba parada não apaga o parecer da outra",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await page.waitForTimeout(2000);
    const id = await ctx.conversaAberta();
    const noServidor = async () => {
      const [linha] = await ctx.banco.consultar(`select data, "updatedAt" from "NexoConversation" where id = $1`, [id]);
      return linha ?? null;
    };
    const pareceresDe = (registro) => (registro?.results ?? []).filter((r) => r.kind === "auditoria");

    const aba2 = await ctx.abrirOutraAba();
    await aba2.waitForTimeout(4000);
    const leituraNaAba2 = await aba2.getByText(/Li as primeiras páginas/).count();
    const pareceresNaAba2 = await aba2.getByRole("button", { name: /Ver o parecer/ }).count();
    ctx.verificar(
      "a aba 2 abriu a mesma conversa, antes do parecer",
      Boolean(id) && (await ctx.conversaAberta(aba2)) === id && leituraNaAba2 > 0 && pareceresNaAba2 === 0,
      `id=${id} leitura=${leituraNaAba2} pareceres=${pareceresNaAba2}`,
    );

    await page.bringToFront();
    await ctx.auditarNoCartao();
    await ctx.esperarParecer(1);
    const subiu = await ctx.esperar(async () => pareceresDe((await noServidor())?.data).length === 1, 30_000);

    // A aba 1 ainda grava de novo depois do parecer subir (o bilhete some com
    // marcarAuditoriaPendente(null), a reescrita pós-commit, o debounce do
    // saveResult): ler `antes` na hora exata em que o parecer chega pega o
    // servidor no meio dessa rajada e deixa a comparação de versão abaixo
    // intermitente. Só leio `antes` depois que dois relógios seguidos, ≥2s
    // um do outro, baterem no mesmo valor (ruling P4, 15/09/2026).
    const leituras = [];
    let leituraAnterior;
    const estabilizou = await ctx.esperar(
      async () => {
        const atual = (await noServidor())?.updatedAt?.getTime() ?? null;
        leituras.push(atual);
        const igual = leituraAnterior !== undefined && atual === leituraAnterior;
        leituraAnterior = atual;
        return igual;
      },
      30_000,
      2000,
    );
    const antes = await noServidor();
    ctx.verificar(
      "o servidor recebeu o parecer da aba 1, com a versão já estabilizada",
      subiu && estabilizou,
      `pareceres no servidor=${pareceresDe(antes?.data).length} leituras=${JSON.stringify(leituras)}`,
    );

    await aba2.bringToFront();
    await ctx.escrever("oi, tudo bem?", aba2);
    await aba2.waitForTimeout(6000);

    const faixa = aba2.getByText("Esta conversa mudou em outra aba", { exact: true });
    ctx.verificar("a aba 2 avisa que a conversa mudou em outra aba, visível de verdade", await ctx.visivelRolando(faixa), `contagem=${await faixa.count()}`);

    const depois = await noServidor();
    ctx.verificar("o servidor continua com o parecer da aba 1", pareceresDe(depois?.data).length === 1, `pareceres=${pareceresDe(depois?.data).length}`);
    ctx.verificar(
      "a mensagem da aba parada não chegou ao servidor",
      Boolean(depois) && !JSON.stringify(depois.data?.messages ?? []).includes("oi, tudo bem?"),
    );
    ctx.verificar(
      "a versão do servidor não mudou",
      Boolean(antes && depois) && depois.updatedAt.getTime() === antes.updatedAt.getTime(),
      `${antes?.updatedAt?.toISOString?.()} -> ${depois?.updatedAt?.toISOString?.()}`,
    );
    const noDisco = await ctx.lerConversa(id);
    ctx.verificar(
      "o disco que as abas dividem continua com o parecer",
      pareceresDe(noDisco).length === 1 && !JSON.stringify(noDisco?.messages ?? []).includes("oi, tudo bem?"),
      `pareceres=${pareceresDe(noDisco).length}`,
    );

    // Outra máquina, com a base de quando abriu: a rota recusa por conta própria.
    const deOutraMaquina = {
      ...noDisco,
      updatedAt: Date.now(),
      messages: [...(noDisco?.messages ?? []), { id: "outra-maquina", role: "user", content: "gravação de outra máquina" }],
    };
    const resposta = await page.request.put(`${ctx.base}/api/nexo/conversas`, {
      data: deOutraMaquina,
      headers: { "x-nexo-versao-base": "1" },
    });
    const corpo = await resposta.json().catch(() => ({}));
    ctx.verificar("a rota responde 409 à gravação com base velha", resposta.status() === 409 && corpo.desatualizada === true, `status=${resposta.status()} corpo=${JSON.stringify(corpo)}`);
    ctx.verificar("e o servidor segue com o parecer", pareceresDe((await noServidor())?.data).length === 1);

    await aba2.getByRole("button", { name: "Recarregar a conversa" }).click({ timeout: 10_000 }).catch(() => {});
    const verNaAba2 = aba2.getByRole("button", { name: /Ver o parecer/ });
    await verNaAba2.first().waitFor({ timeout: 30_000 }).catch(() => {});
    const pareceresNaAba2DepoisDeRecarregar = await verNaAba2.count();
    const pareceerVisivelDeVerdade = pareceresNaAba2DepoisDeRecarregar === 1 && (await ctx.visivelRolando(verNaAba2));
    ctx.verificar("recarregada, a aba 2 mostra o parecer, visível de verdade", pareceerVisivelDeVerdade, `botões=${pareceresNaAba2DepoisDeRecarregar}`);
    // Vazia não prova nada: "a faixa sai" só conta se a recarga de fato
    // aconteceu, provada pelo parecer visível na tela (ruling P5, 15/09/2026).
    ctx.verificar(
      "e a faixa sai, com a recarga provada pelo parecer visível",
      pareceerVisivelDeVerdade && (await faixa.count()) === 0,
      `parecer visível=${pareceerVisivelDeVerdade} faixas=${await faixa.count()}`,
    );
  },
};
