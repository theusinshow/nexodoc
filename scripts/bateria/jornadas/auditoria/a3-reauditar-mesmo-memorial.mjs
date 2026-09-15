// A3 — o fluxo que desmontou em 14/09/2026: auditar o 117_25, e auditar de novo
// transcrevendo. Cada rodada com cartão e parecer próprios (a486a53).
//
// DEFEITO PEGO POR ESTA JORNADA (14/09/2026, ver fix-a3-report.md): a rodada 2
// fechava certa NA TELA e só a rodada 1 ia para o IndexedDB. `saveResult`
// agendava a gravação e, na mesma volta, `marcarAuditoriaPendente(null)` gravava
// JÁ — cancelando o debounce e lendo um snapshot que só acompanha o estado
// depois do commit do React. Online, o F5 escondia a perda: a rede de
// recuperação (`parecerARecuperar` → GET /api/audits/<id>) buscava a rodada 2
// no Postgres. Sem essa rede, o F5 voltava com a rodada 1 ("14 PÁGINAS NÃO
// FORAM LIDAS"). Por isso o F5 abaixo corta /api/audits: é o disco, e só ele,
// que tem de trazer as duas rodadas de volta.
// Teste puro que trava a regra: scripts/test-agenda-de-gravacao.ts.
export default {
  id: "a3",
  area: "auditoria",
  titulo: "reauditar o mesmo memorial abre outra rodada",
  async rodar(ctx) {
    // O banco NÃO é esvaziado entre jornadas (só uma vez, no início da bateria
    // inteira): numa corrida completa a1 roda antes de a3 no MESMO banco, e
    // contar "Audit" sem filtro incluiria a auditoria que a1 já gravou ali.
    // Cada jornada só lê o que ELA MESMA criou (ver a consulta ao banco abaixo).
    await ctx.login();

    // Rodada 1: sem transcrever → parecer parcial (14 folhas não lidas). Mesmos
    // seletores de a1-leitura-da-ia-aborta.mjs — mesmo documento, mesmo início.
    await ctx.anexar(["tests/117_25_md_geral_a.pdf"]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();
    await (await ctx.esperarBotao(/Auditar sem transcrever/, 120_000)).click();
    await ctx.esperarTexto(/14 PÁGINAS NÃO FORAM LIDAS/, 600_000);

    // Rodada 2: pelo chip do cartão-âncora ("Transcrever e auditar de novo" —
    // AuditoriaAncora, ConfirmationCard.tsx:2971 — quando há folha não lida; cai
    // para "Auditar de novo" quando não há), transcrevendo desta vez.
    const deNovo = await ctx.esperarBotao(/Transcrever e auditar de novo|Auditar de novo/, 30_000);
    await deNovo.click();
    const transcrever = await ctx.esperarBotao(/^Transcrever e auditar$/, 180_000);
    ctx.verificar("cartão novo oferece Transcrever e auditar", await transcrever.isEnabled());
    await transcrever.click();

    // Fim da rodada 2: dois cartões com parecer ("Ver o parecer" em cada um —
    // AuditoriaAncora, ConfirmationCard.tsx:2966).
    const verParecer = ctx.page.getByRole("button", { name: /Ver o parecer/ });
    // `waitFor` e não um laço de 3 em 3s: a leitura do disco abaixo tem de
    // acontecer logo depois de a rodada 2 aparecer, dentro da janela de 500ms
    // em que um F5 a perderia se a gravação dependesse do debounce.
    await verParecer.nth(1).waitFor({ timeout: 900_000 }).catch(() => {});
    // A espera acima não verifica nada sozinha: sem esta linha, "a rodada 2
    // nunca apareceu" e "apareceu mas não foi gravada" dariam a mesma falha lá
    // embaixo, no disco.
    const qtdNaTela = await verParecer.count();
    ctx.verificar("a tela mostra as duas rodadas", qtdNaTela === 2, `botões Ver o parecer=${qtdNaTela}`);
    // MENOS que os 500ms do debounce, de propósito: o flush agora grava de novo
    // no commit que pôs a rodada 2 na tela (agenda-de-gravacao.ts), e não meio
    // segundo depois. Esperar 2s escondia a janela em que um F5 perdia a rodada.
    await ctx.page.waitForTimeout(300);

    // A conversa SOB TESTE é a que o produto lembra como aberta — não "a de
    // `updatedAt` mais alto", que numa bateria com mais conversas poderia ser
    // outra (o falso positivo do projeto de exemplo, agosto de 2026).
    const idDaConversa = await ctx.page.evaluate(() => localStorage.getItem("nexo:ultima-conversa"));
    const lerConversa = async () => (await ctx.indexeddb.lerConversas()).find((c) => c.id === idDaConversa);
    const lerPareceres = async () => ((await lerConversa())?.results ?? []).filter((r) => r.kind === "auditoria");
    const pareceres = await lerPareceres();
    // O bilhete da auditoria em voo sai do disco quando ela termina. Se ficar,
    // todo F5 reabre a conversa como "auditoria em andamento" para sempre — o
    // defeito que `marcarAuditoriaPendente` escreve no snapshot à mão para evitar.
    const bilheteAposRodada2 = (await lerConversa())?.auditoriaPendente ?? null;
    ctx.verificar("o bilhete da auditoria saiu do disco", bilheteAposRodada2 === null, JSON.stringify(bilheteAposRodada2));
    ctx.verificar("duas rodadas gravadas", pareceres.length === 2, `conversa=${idDaConversa} pareceres=${pareceres.length}`);
    ctx.verificar(
      "cada rodada com o próprio id",
      pareceres.length === 2 && new Set(pareceres.map((r) => r.artifactId)).size === pareceres.length,
      pareceres.map((r) => r.artifactId).join(" | "),
    );
    const transcritas = (r) => r.payload?.report?.arquivos_analisados?.[0]?.cobertura?.paginas_transcritas ?? 0;
    ctx.verificar("a rodada 2 leu as folhas transcritas", pareceres.some((r) => transcritas(r) > 0));

    // R11: presença no DOM não basta — um botão fora da dobra passaria em
    // `count()` sem chegar aos olhos de quem lê a tela. A contagem é o PONTO
    // desta verificação ("só a rodada mais recente"), então ela fica na
    // condição junto da visibilidade; o detalhe mostra o número separado.
    const auditarDeNovoAgora = ctx.page.getByRole("button", { name: /auditar de novo/i });
    const qtdAuditarDeNovo = await auditarDeNovoAgora.count();
    ctx.verificar(
      "só a rodada mais recente oferece auditar de novo, visível de verdade",
      qtdAuditarDeNovo === 1 && (await ctx.visivelRolando(auditarDeNovoAgora)),
      `contagem=${qtdAuditarDeNovo}`,
    );

    // A faixa [data-diff-do-parecer] só aparece na vista "Auditoria" do palco
    // (PalcoDoNexo.tsx:381, dentro de `mostrandoAuditoria && report`). O palco
    // já escolhe essa vista sozinho assim que há uma auditoria em curso ou
    // pronta (PalcoDoNexo.tsx:216-223) — o clique aqui é só a garantia de que
    // uma escolha manual anterior (ex.: "Mapa do volume") não ficou no caminho.
    const chipAuditoria = ctx.page.getByRole("button", { name: /^Auditoria$/ });
    if ((await chipAuditoria.count()) > 0) await chipAuditoria.first().click();
    await ctx.page.waitForTimeout(1000);

    const faixaDoDiff = ctx.page.locator("[data-diff-do-parecer]");
    const qtdFaixaDoDiff = await faixaDoDiff.count();
    ctx.verificar(
      "o palco mostra o que mudou entre as rodadas, visível de verdade",
      qtdFaixaDoDiff === 1 && (await ctx.visivelRolando(faixaDoDiff)),
      `contagem=${qtdFaixaDoDiff}`,
    );

    // R12: só as auditorias que ESTA jornada criou — pelos `auditId` que a
    // própria conversa registrou na largada (`registrarAuditoria`; o id do
    // cliente é o id da linha em "Audit"). Filtrar por `"createdAt" >= inicio`
    // não bastava: em `--so-jornadas auditoria` (14/09/2026) a consulta contou
    // três COMPLETED — a da a1, que roda logo antes no mesmo banco, entrou.
    // Comparar o relógio da jornada com uma coluna gravada por outro processo
    // é frágil (o `now()` do banco medido ali estava 29s atrás da máquina).
    const registradas = (await ctx.indexeddb.lerConversas()).find((c) => c.id === idDaConversa)?.auditorias ?? [];
    const auditorias = await ctx.banco.consultar(`select id, status from "Audit" where id = any($1::text[])`, [
      registradas.map((a) => a.auditId),
    ]);
    ctx.verificar(
      "as duas auditorias concluídas no banco",
      registradas.length === 2 && auditorias.filter((a) => a.status === "COMPLETED").length === 2,
      `registradas=${registradas.length} ${JSON.stringify(auditorias)}`,
    );

    // F5 COMO O ENGENHEIRO DARIA — mas sem a rede de recuperação. Com ela, o
    // parecer que faltasse no disco voltaria do Postgres e esconderia a perda
    // (medido: foi exatamente o que aconteceu antes do conserto). O F5 reabre
    // sozinho a conversa lembrada (NexoWorkspace, "VOLTAR PARA ONDE O
    // ENGENHEIRO PAROU"); nada aqui clica no histórico.
    await ctx.page.route("**/api/audits/**", (rota) => rota.abort());
    try {
      await ctx.page.reload({ waitUntil: "domcontentloaded" });
      const fimDoF5 = Date.now() + 60_000;
      while (Date.now() < fimDoF5 && (await verParecer.count()) < 2) {
        await ctx.page.waitForTimeout(1000);
      }
      // A conversa aberta, pela TELA: o `localStorage` sobrevive ao F5 de
      // qualquer jeito e não diz o que o engenheiro vê. A barra lateral marca a
      // aberta com `aria-current` (CartaoDeProjeto.tsx), e o disco tem só esta
      // conversa — então a marcada é a sob teste, e não outra.
      const ativa = ctx.page.locator('button[aria-current="true"]', { hasText: /Memorial/ });
      const qtdAtiva = await ativa.count();
      const conversasNoDisco = (await ctx.indexeddb.lerConversas()).length;
      ctx.verificar(
        "depois do F5 a barra lateral marca a conversa sob teste como aberta",
        qtdAtiva === 1 && conversasNoDisco === 1 && (await ctx.visivelRolando(ativa)),
        `marcadas=${qtdAtiva} conversas no disco=${conversasNoDisco}`,
      );
      const qtdDepoisDoF5 = await verParecer.count();
      ctx.verificar(
        "depois do F5, sem a rede de recuperação, as duas rodadas voltam do disco",
        qtdDepoisDoF5 === 2 && (await ctx.visivelRolando(verParecer.last())),
        `botões Ver o parecer=${qtdDepoisDoF5}`,
      );
      const recuperadasPorVisao = ctx.page.getByText(/páginas sem texto recuperadas por visão/);
      ctx.verificar(
        "depois do F5 o palco mostra o parecer da rodada 2, visível de verdade",
        (await recuperadasPorVisao.count()) > 0 && (await ctx.visivelRolando(recuperadasPorVisao)),
      );
      const pareceresDepois = await lerPareceres();
      ctx.verificar(
        "depois do F5 o disco segue com as duas rodadas",
        pareceresDepois.length === 2 && pareceresDepois.some((r) => transcritas(r) > 0),
        `pareceres=${pareceresDepois.length}`,
      );
      const bilheteDepoisDoF5 = (await lerConversa())?.auditoriaPendente ?? null;
      ctx.verificar(
        "depois do F5 nenhum bilhete de auditoria em voo voltou",
        bilheteDepoisDoF5 === null,
        JSON.stringify(bilheteDepoisDoF5),
      );
    } finally {
      await ctx.page.unroute("**/api/audits/**");
    }
  },
};
