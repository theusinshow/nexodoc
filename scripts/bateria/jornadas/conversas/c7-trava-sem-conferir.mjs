// C7 — a trava que ninguém provou (15/09/2026, depois da segunda rodada).
//
// Um 409 com a base aberta do disco sem conferir o servidor deixa a marca
// "manter": pode ter sido a gravação atrasada desta mesma aba. Até 9cd14e6 a
// faixa dizia "Esta conversa mudou em outra aba" — falso ali — e o único botão
// trocava o disco pela cópia do servidor, apagando as edições que só existiam
// nesta máquina. Agora a faixa diz o que se sabe, e a recarga que apagaria algo
// pede confirmação; "Continuar travada" deixa o disco como está.
//
// E reabrir pela barra não fura a confirmação (revisão da frente A, 15/09/2026):
// clicar de novo na conversa, ou sair para outra e voltar, lia do servidor com a
// trava na memória e pousava a cópia dele no disco sem perguntar.
//
// O estado é montado à mão, como na c4: a conversa no servidor (PUT sem base),
// a mesma no disco com uma edição a mais e hora mais nova, e a marca "manter".
// Os cliques não engolem erro: botão que não aparece derruba a jornada.
const TITULO = "BATERIA C7 TRAVA SEM CONFERIR";
const SO_AQUI = "edição só desta máquina";

export default {
  id: "c7",
  area: "conversas",
  titulo:
    "trava sem conferir: a faixa não acusa outra aba, e nem a faixa nem a barra trocam o disco sem confirmação",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const agora = Date.now();
    const id = `bateria-c7-${agora}`;
    const doServidor = {
      id,
      title: TITULO,
      createdAt: agora - 120_000,
      updatedAt: agora - 1_000,
      seloResults: [],
      results: [],
      messages: [
        { id: "u1", role: "user", content: "mensagem que o servidor tem" },
      ],
    };
    const resposta = await page.request.put(`${ctx.base}/api/nexo/conversas`, {
      data: doServidor,
    });
    ctx.verificar(
      "o servidor guardou a conversa semeada",
      resposta.ok(),
      `status=${resposta.status()}`,
    );

    /*
     * A MAIS NOVA DA BARRA, de propósito (CI de 741aaed, 15/09/2026): com as
     * horas no passado, as conversas que a c6 acabara de criar ficavam mais
     * novas, e esta caía em "a outra conversa" do cartão "A endereçar" — o
     * clique pelo título não achava nada. O disco segue mais novo que o servidor.
     */
    const noDiscoAntes = agora;
    await ctx.indexeddb.gravarConversa({
      ...doServidor,
      updatedAt: noDiscoAntes,
      messages: [
        ...doServidor.messages,
        { id: "u2", role: "user", content: SO_AQUI },
      ],
    });
    await page.evaluate(
      (chave) => localStorage.setItem(chave, "manter"),
      `nexo:recusada-pelo-servidor:${id}`,
    );

    await ctx.abrirConversa(TITULO);

    const faixaSemConferir = page.getByText(
      "Não deu para confirmar se esta conversa é a mais nova",
      { exact: true },
    );
    const faixaOutraAba = page.getByText("Esta conversa mudou em outra aba", {
      exact: true,
    });
    await faixaSemConferir.first().waitFor({ timeout: 30_000 });
    ctx.verificar(
      "a conversa abre travada com a faixa sem conferir, visível de verdade, e sem acusar outra aba",
      (await ctx.visivelRolando(faixaSemConferir)) &&
        (await faixaOutraAba.count()) === 0,
      `sem conferir=${await faixaSemConferir.count()} outra aba=${await faixaOutraAba.count()}`,
    );

    const recarregar = page.getByRole("button", {
      name: "Recarregar do servidor",
    });
    await recarregar.click({ timeout: 10_000 });
    const aviso = page.getByText(/diferente da do servidor/);
    await aviso.first().waitFor({ timeout: 15_000 });
    ctx.verificar(
      "recarregar do servidor avisa que a cópia deste navegador é outra, antes de trocar",
      await ctx.visivelRolando(aviso),
      `aviso=${await aviso.count()}`,
    );

    await page
      .getByRole("button", { name: "Continuar travada" })
      .click({ timeout: 10_000 });
    await recarregar.waitFor({ timeout: 10_000 });
    const discoIntacto = async () => {
      const rec = await ctx.lerConversa(id);
      return {
        ok:
          JSON.stringify(rec?.messages ?? []).includes(SO_AQUI) &&
          rec?.updatedAt === noDiscoAntes,
        detalhe: `updatedAt=${rec?.updatedAt} mensagens=${rec?.messages?.length}`,
      };
    };
    let disco = await discoIntacto();
    ctx.verificar(
      "'Continuar travada' não mexe no disco: a edição só desta máquina continua lá",
      disco.ok,
      disco.detalhe,
    );
    ctx.verificar(
      "e volta à faixa de antes, com 'Recarregar do servidor' visível de novo",
      (await faixaSemConferir.count()) === 1 &&
        (await ctx.visivelRolando(recarregar)) &&
        (await aviso.count()) === 0,
      `faixas=${await faixaSemConferir.count()} aviso=${await aviso.count()}`,
    );

    // Reabrir pela barra: clicar de novo na conversa aberta.
    const naBarra = (titulo) =>
      page.getByRole("button", { name: new RegExp(titulo) }).first();
    await naBarra(TITULO).click({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    disco = await discoIntacto();
    ctx.verificar(
      "clicar de novo na conversa pela barra não troca o disco: a edição só desta máquina continua lá",
      disco.ok,
      disco.detalhe,
    );
    await faixaSemConferir.first().waitFor({ timeout: 15_000 });
    ctx.verificar(
      "e ela continua travada, com a faixa sem conferir",
      (await faixaSemConferir.count()) === 1,
      `faixas=${await faixaSemConferir.count()}`,
    );

    // Sair (para uma conversa nova, pelo "Novo projeto") e voltar pela barra.
    await page
      .getByRole("button", { name: "Novo projeto" })
      .click({ timeout: 10_000 });
    await faixaSemConferir.waitFor({ state: "detached", timeout: 15_000 });
    await naBarra(TITULO).click({ timeout: 10_000 });
    await faixaSemConferir.first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2000);
    disco = await discoIntacto();
    ctx.verificar(
      "sair para uma conversa nova e voltar pela barra não troca o disco, e a conversa volta travada",
      disco.ok && (await faixaSemConferir.count()) === 1,
      `${disco.detalhe} faixas=${await faixaSemConferir.count()}`,
    );

    await recarregar.click({ timeout: 10_000 });
    await page
      .getByRole("button", { name: "Trocar pela do servidor" })
      .click({ timeout: 15_000 });
    const trocou = await ctx.esperar(
      async () =>
        (await ctx.lerConversa(id))?.updatedAt === doServidor.updatedAt,
      30_000,
    );
    const depoisDeTrocar = await ctx.lerConversa(id);
    ctx.verificar(
      "confirmada, a troca traz a cópia do servidor para o disco",
      trocou &&
        !JSON.stringify(depoisDeTrocar?.messages ?? []).includes(SO_AQUI),
      `updatedAt=${depoisDeTrocar?.updatedAt} mensagens=${depoisDeTrocar?.messages?.length}`,
    );
    const faixaSaiu = await ctx.esperar(
      async () => (await faixaSemConferir.count()) === 0,
      15_000,
    );
    ctx.verificar(
      "e a faixa sai",
      faixaSaiu,
      `faixas=${await faixaSemConferir.count()}`,
    );
  },
};
