// C3 — a aba 1 audita; a aba 2 abriu a mesma conversa antes e ficou parada; a
// aba 2 grava depois. Decidido pelo Matheus em 15/09/2026: a aba desatualizada
// é recusada, avisa e oferece recarregar, sem sobrescrever.
//
// Duas abas são duas páginas do MESMO contexto: mesmos cookies, mesmo
// IndexedDB, mesmo `nexo:ultima-conversa` — é assim que a aba 2 abre a mesma
// conversa sozinha. A rota também é exercitada direto, com uma base velha: é o
// caminho de outra máquina, que o IndexedDB desta não protege.
import fs from "node:fs";
import path from "node:path";

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

    /*
     * O PRIMEIRO GESTO PAGO DA ABA PARADA NÃO SAI (15/09/2026). Até 9cd14e6 a
     * trava só acendia com a gravação recusada: o primeiro turno do agente de
     * uma aba parada ia ao modelo (medido com a conferência desligada:
     * POSTs /api/nexo/agent=1). Agora a aba confere a versão com o servidor
     * antes de gastar, e a faixa acende sem a aba ter gravado nada.
     *
     * O gesto é o "Auditar" do cartão, o mais caro. Até a a8 (15/09/2026) ele
     * nascia cinza na aba restaurada — o memorial retido chegava antes da
     * limpeza da view transition e era apagado por ela —, e esta jornada provava
     * a recusa por um envio no chat. Consertado, o clique volta a ser a prova: o
     * botão tem de estar HABILITADO antes, senão "nenhum POST" seria só um botão
     * que não clica.
     */
    const ePost = (caminho) => (req) => req.method() === "POST" && new URL(req.url()).pathname === caminho;
    await aba2.bringToFront();
    const auditarNaAba2 = aba2.getByRole("button", { name: /^Auditar$/ });
    const habilitadoAntes = await ctx.esperar(async () => (await auditarNaAba2.count()) > 0 && (await auditarNaAba2.last().isEnabled()), 20_000, 250);
    ctx.verificar(
      "antes do gesto, o Auditar da aba 2 está habilitado e visível de verdade",
      habilitadoAntes && (await ctx.visivelRolando(auditarNaAba2.last())),
      `auditar=${await auditarNaAba2.count()}`,
    );
    const turnosDaAba2 = ctx.contarRequisicoes(ePost("/api/nexo/agent"), aba2);
    const auditoriasDaAba2 = ctx.contarRequisicoes(ePost("/api/audit"), aba2);
    await auditarNaAba2.last().click({ timeout: 10_000 }).catch(() => {});
    await aba2.waitForTimeout(6000);
    turnosDaAba2.parar();
    auditoriasDaAba2.parar();

    const faixa = aba2.getByText("Esta conversa mudou em outra aba", { exact: true });
    ctx.verificar("a aba 2 avisa que a conversa mudou em outra aba, visível de verdade", await ctx.visivelRolando(faixa), `contagem=${await faixa.count()}`);
    ctx.verificar(
      "o Auditar da aba 2, parada, é recusado antes de gastar: nenhum POST a /api/audit nem a /api/nexo/agent",
      turnosDaAba2.total() === 0 && auditoriasDaAba2.total() === 0,
      `POSTs /api/nexo/agent=${turnosDaAba2.total()} /api/audit=${auditoriasDaAba2.total()}`,
    );

    // A ABA TRAVADA NÃO GASTA (revisão final, 15/09/2026): com a faixa acesa, o
    // envio e o "Auditar" ficam travados — o que rodasse seria pago e descartado.
    const campoNaAba2 = aba2.locator('[data-tour="composer"] textarea').last();
    const campoTravado = await campoNaAba2.isDisabled().catch(() => false);
    const motivoNoCampo = (await campoNaAba2.getAttribute("placeholder").catch(() => null)) ?? "";
    ctx.verificar(
      "a aba travada não gasta: o envio do chat trava e diz que a conversa mudou em outra aba",
      campoTravado && /mudou em outra aba/.test(motivoNoCampo),
      `desabilitado=${campoTravado} placeholder=${motivoNoCampo}`,
    );
    const quantosAuditar = await auditarNaAba2.count();
    let auditarTravados = 0;
    for (let i = 0; i < quantosAuditar; i++) if (await auditarNaAba2.nth(i).isDisabled()) auditarTravados++;
    ctx.verificar(
      "a aba travada não gasta: nenhum 'Auditar' clicável",
      quantosAuditar > 0 && auditarTravados === quantosAuditar,
      `auditar=${quantosAuditar} travados=${auditarTravados}`,
    );
    // O botão cinza diz o porquê em TEXTO, não só no tooltip (15/09/2026).
    const motivoAoLado = aba2.locator("[data-motivo-sem-gasto]");
    const motivosAoLado = await motivoAoLado.count();
    ctx.verificar(
      "o botão travado diz o porquê em texto ao lado, visível de verdade",
      auditarTravados > 0 &&
        motivosAoLado > 0 &&
        /mudou em outra aba/.test((await motivoAoLado.first().textContent()) ?? "") &&
        (await ctx.visivelRolando(motivoAoLado)),
      `travados=${auditarTravados} motivos=${motivosAoLado}`,
    );

    /*
     * NEM LÊ CARIMBO (última onda da frente A, 15/09/2026): soltar uma prancha na
     * aba travada não chama o leitor de selo — modelo pago por folha, que a fila
     * descartaria — e a conversa diz por quê.
     */
    const selosDaAba2 = ctx.contarRequisicoes(ePost("/api/ld/extract-stamp"), aba2);
    await aba2.locator('input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles([path.resolve(f.pranchas[0])]);
    const leituraRecusada = aba2.getByText(/Não li 1 prancha: Esta conversa mudou em outra aba/);
    const avisou = await ctx.esperar(async () => (await leituraRecusada.count()) > 0, 60_000, 500);
    await aba2.waitForTimeout(3000);
    selosDaAba2.parar();
    ctx.verificar(
      "a aba travada não lê o carimbo da prancha solta: nenhum POST a /api/ld/extract-stamp, e a conversa diz por quê",
      avisou && selosDaAba2.total() === 0 && (await ctx.visivelRolando(leituraRecusada)),
      `aviso=${avisou} POSTs /api/ld/extract-stamp=${selosDaAba2.total()}`,
    );

    /*
     * E A CORREÇÃO MEMORIAL → PRANCHA RECUSADA NÃO MEXE NO CHIP (15/09/2026). A
     * recusa da leitura vinha DEPOIS de o chip trocar de papel: ele dizia
     * "prancha" com a leitura recusada e o memorial ainda retido. Conta pelos
     * botões: o chip do memorial oferece "tratar como prancha"; virado, passaria
     * a oferecer "tratar como memorial", como o da prancha solta acima.
     */
    const paraPrancha = aba2.getByRole("button", { name: /^tratar como prancha$/ });
    const paraMemorial = aba2.getByRole("button", { name: /^tratar como memorial$/ });
    const classificacoesDaAba2 = ctx.contarRequisicoes(ePost("/api/nexo/classify"), aba2);
    await aba2.locator('input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles([path.resolve(f.memorialSemCodigo)]);
    const chipDoMemorial = await ctx.esperar(async () => (await paraPrancha.count()) > 0, 30_000, 250);
    await aba2.waitForTimeout(3000); // o pré-voo e a leitura do memorial assentam
    const antesDaCorrecao = { prancha: await paraPrancha.count(), memorial: await paraMemorial.count(), recusas: await leituraRecusada.count() };
    await paraPrancha.last().click({ timeout: 10_000 }).catch(() => {});
    const recusouCorrecao = await ctx.esperar(async () => (await leituraRecusada.count()) > antesDaCorrecao.recusas, 20_000, 250);
    await aba2.waitForTimeout(1000);
    const depoisDaCorrecao = { prancha: await paraPrancha.count(), memorial: await paraMemorial.count(), recusas: await leituraRecusada.count() };
    ctx.verificar(
      "a aba travada recusa corrigir o memorial para prancha, diz por quê e o chip continua memorial",
      chipDoMemorial &&
        recusouCorrecao &&
        depoisDaCorrecao.prancha === antesDaCorrecao.prancha &&
        depoisDaCorrecao.memorial === antesDaCorrecao.memorial &&
        (await ctx.visivelRolando(leituraRecusada.last())),
      `antes=${JSON.stringify(antesDaCorrecao)} depois=${JSON.stringify(depoisDaCorrecao)}`,
    );

    /*
     * NEM GUARDA O MEMORIAL (15/09/2026). `salvarMemorial` escrevia o arquivo
     * direto no IndexedDB que as duas abas dividem, sob `<conversa>:memorial`: o
     * memorial solto na aba parada trocava o da aba 1, e o F5 dela voltava com o
     * arquivo errado. Confere pelo próprio blob, e pelo tamanho do memorial que a
     * aba 1 anexou.
     */
    classificacoesDaAba2.parar();
    const memorialRecusado = aba2.getByText(/Não guardei o memorial md_bateria_sem_codigo\.pdf: Esta conversa mudou em outra aba/);
    const blobRetido = await aba2.evaluate(
      (chave) =>
        new Promise((res) => {
          const pedido = indexedDB.open("nexo");
          pedido.onsuccess = () => {
            const leitura = pedido.result.transaction("result_blobs").objectStore("result_blobs").get(chave);
            leitura.onsuccess = () => {
              const blob = leitura.result?.blob;
              res(blob ? { nome: blob.name ?? null, tamanho: blob.size } : null);
            };
            leitura.onerror = () => res(null);
          };
          pedido.onerror = () => res(null);
        }),
      `${id}:memorial`,
    );
    const tamanhoDaAba1 = fs.statSync(f.memorialCurto).size;
    ctx.verificar(
      "a aba travada não guarda nem lê o memorial solto: o blob continua o da aba 1, nenhum POST a /api/nexo/classify, e a conversa diz por quê",
      Boolean(blobRetido) &&
        blobRetido.tamanho === tamanhoDaAba1 &&
        classificacoesDaAba2.total() === 0 &&
        (await ctx.visivelRolando(memorialRecusado)),
      `blob=${JSON.stringify(blobRetido)} tamanhoDaAba1=${tamanhoDaAba1} POSTs /api/nexo/classify=${classificacoesDaAba2.total()} aviso=${await memorialRecusado.count()}`,
    );

    const depois = await noServidor();
    ctx.verificar("o servidor continua com o parecer da aba 1", pareceresDe(depois?.data).length === 1, `pareceres=${pareceresDe(depois?.data).length}`);
    ctx.verificar(
      "o Auditar recusado não registrou auditoria nem bilhete no servidor",
      Boolean(depois) && (depois.data?.auditorias ?? []).length === 1 && !depois.data?.auditoriaPendente,
      `auditorias=${(depois?.data?.auditorias ?? []).length} bilhete=${JSON.stringify(depois?.data?.auditoriaPendente ?? null)}`,
    );
    ctx.verificar(
      "a versão do servidor não mudou",
      Boolean(antes && depois) && depois.updatedAt.getTime() === antes.updatedAt.getTime(),
      `${antes?.updatedAt?.toISOString?.()} -> ${depois?.updatedAt?.toISOString?.()}`,
    );
    const noDisco = await ctx.lerConversa(id);
    ctx.verificar(
      "o disco que as abas dividem continua com o parecer, sem bilhete da aba parada",
      pareceresDe(noDisco).length === 1 && (noDisco?.auditorias ?? []).length === 1 && !noDisco?.auditoriaPendente,
      `pareceres=${pareceresDe(noDisco).length} auditorias=${(noDisco?.auditorias ?? []).length}`,
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
