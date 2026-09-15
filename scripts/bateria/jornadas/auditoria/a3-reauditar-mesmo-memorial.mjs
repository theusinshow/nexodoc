// A3 — o fluxo que desmontou em 14/09/2026: auditar o 117_25, e auditar de novo
// transcrevendo. Cada rodada com cartão e parecer próprios (a486a53).
//
// DEFEITO DE PRODUTO PEGO POR ESTA JORNADA (14/09/2026, ver task-9-report.md):
// a rodada 2 fecha certa NA TELA (dois cartões, parecer novo, faixa de diff),
// mas a gravação no IndexedDB da PRIMEIRA rodada nunca chega a incluir a
// segunda — `marcarAuditoriaPendente(null)` no `finally` de `confirm()`
// (ConfirmationCard.tsx) dispara `flushPersist()` (síncrono, cancela o
// debounce) usando um `snapshotRef.current.results` que ainda não foi
// resincronizado com o `setResults` que o próprio `saveResult` acabou de
// disparar — o efeito que copia `results` para o ref só roda depois do
// commit do render, e não há `await` entre os dois para esperá-lo. O disco
// fica com só a rodada 1; um F5 depois disto perderia a rodada 2 inteira.
// NÃO é bug desta jornada: as verificações abaixo ficam vermelhas de
// propósito, documentando o defeito, e o produto não foi tocado aqui.
export default {
  id: "a3",
  area: "auditoria",
  titulo: "reauditar o mesmo memorial abre outra rodada",
  async rodar(ctx) {
    // O banco NÃO é esvaziado entre jornadas (só uma vez, no início da bateria
    // inteira): numa corrida completa a1 roda antes de a3 no MESMO banco, e
    // contar "Audit" sem filtro incluiria a auditoria que a1 já gravou ali.
    // Cada jornada só lê o que ELA MESMA criou.
    const inicio = new Date();
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
    const fim = Date.now() + 900_000;
    while (Date.now() < fim && (await ctx.page.getByRole("button", { name: /Ver o parecer/ }).count()) < 2) {
      await ctx.page.waitForTimeout(3000);
    }
    // Tempo para a tela assentar antes de ler o disco. Não é sobre o debounce
    // do IndexedDB (500ms bastariam para isso) — é só para não ler no meio de
    // um reflow do React.
    await ctx.page.waitForTimeout(2000);

    const conversa = (await ctx.indexeddb.lerConversas()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const pareceres = (conversa?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("duas rodadas gravadas", pareceres.length === 2, String(pareceres.length));
    ctx.verificar(
      "cada rodada com o próprio id",
      new Set(pareceres.map((r) => r.artifactId)).size === pareceres.length,
      pareceres.map((r) => r.artifactId).join(" | "),
    );
    ctx.verificar(
      "a rodada 2 leu as folhas transcritas",
      pareceres.some((r) => (r.payload?.report?.arquivos_analisados?.[0]?.cobertura?.paginas_transcritas ?? 0) > 0),
    );

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
      qtdFaixaDoDiff > 0 && (await ctx.visivelRolando(faixaDoDiff)),
      `contagem=${qtdFaixaDoDiff}`,
    );

    // R12: só as auditorias que ESTA jornada criou (ver a1-leitura-da-ia-aborta.mjs).
    const auditorias = await ctx.banco.consultar(
      `select status from "Audit" where "createdAt" >= $1 order by "createdAt"`,
      [inicio],
    );
    ctx.verificar(
      "as duas auditorias concluídas no banco",
      auditorias.filter((a) => a.status === "COMPLETED").length === 2,
      JSON.stringify(auditorias),
    );
  },
};
