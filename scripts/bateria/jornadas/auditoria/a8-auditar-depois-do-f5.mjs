// A8 — o "Auditar" do cartão numa aba RESTAURADA. Suspeita aberta em 15/09/2026
// (medida na c3): na segunda aba que abre a última conversa, e no F5, o botão
// nascia cinza e ficava assim — o memorial retido não voltava ao cartão, e a
// conversa restaurada não conseguia mais auditar o documento que ela mesma leu.
//
// DEFEITO PEGO POR ESTA JORNADA (15/09/2026, docs/bateria/defeitos-achados.md):
// reproduzido nas duas portas. `selectConv` zerava `memorialFile` dentro do
// callback da view transition, que o navegador chama quadros depois; o memorial
// retido voltava do IndexedDB antes (linha do tempo medida: pedido 931ms,
// memorial 997ms, callback 1018ms) e a limpeza chegava por último. Teste puro
// que trava a regra: scripts/test-transicao-do-shell.ts.
//
// Duas portas para a mesma restauração (`selectConv` em NexoWorkspace.tsx):
//   1. uma segunda aba que abre sozinha a última conversa (como na c3);
//   2. o F5 na aba original — e aí o clique vai até o fim: um POST a
//      /api/audit e o parecer na tela.
// A aba 2 fecha ANTES do F5 e sem gastar nada: se ela auditasse, a aba 1
// ficaria desatualizada, e a trava (c3) deixaria o botão cinza por um motivo
// que é o certo — e que não é o desta jornada.

/** Rótulo e estado do botão primário do cartão de auditoria mais novo. */
async function estadoDoAuditar(pagina) {
  const botao = pagina.getByRole("button", { name: /^(Auditar|Conferindo páginas…|Transcrever e auditar)$/ }).last();
  if ((await botao.count()) === 0) return { existe: false, rotulo: null, habilitado: false };
  const rotulo = ((await botao.textContent().catch(() => "")) ?? "").trim();
  const habilitado = await botao.isEnabled().catch(() => false);
  return { existe: true, rotulo, habilitado };
}

/**
 * O memorial NA LINHA "Memorial" do cartão, e não em qualquer lugar: o nome do
 * arquivo também aparece na mensagem do anexo, e contar essa passaria sem o
 * cartão ter recebido arquivo nenhum.
 */
function memorialNoCartao(pagina, nome) {
  return pagina
    .locator("div.flex.items-baseline", { has: pagina.getByText("Memorial", { exact: true }) })
    .getByText(nome, { exact: true })
    .last();
}

/**
 * Espera o "Auditar" habilitar, anotando a linha do tempo (a cada 250ms) para
 * que uma falha diga o que a tela mostrou, e não só "não habilitou".
 */
async function esperarAuditarHabilitado(pagina, ms) {
  const inicio = Date.now();
  const linha = [];
  let ultimo = "";
  while (Date.now() - inicio < ms) {
    const e = await estadoDoAuditar(pagina);
    const marca = `${e.existe ? e.rotulo : "(sem botão)"}|${e.habilitado ? "enabled" : "disabled"}`;
    if (marca !== ultimo) {
      linha.push(`${Date.now() - inicio}ms ${marca}`);
      ultimo = marca;
    }
    if (e.existe && e.rotulo === "Auditar" && e.habilitado) return { ok: true, linha };
    await pagina.waitForTimeout(250);
  }
  return { ok: false, linha };
}

export default {
  id: "a8",
  area: "auditoria",
  titulo: "o Auditar do cartão habilita na aba restaurada (segunda aba e F5)",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    const nomeDoMemorial = f.memorialCurto.split(/[\\/]/).pop();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    const antes = await esperarAuditarHabilitado(page, 60_000);
    // Sem isto, "não habilita depois do F5" poderia ser um cartão que nunca
    // habilitou em lugar nenhum.
    ctx.verificar("antes de restaurar, o Auditar do cartão habilita", antes.ok, antes.linha.join(" → "));
    // E o localizador do memorial acha o nome ANTES: senão o "não mostra" de
    // depois poderia ser só um seletor que nunca achou nada.
    const memorialAntes = memorialNoCartao(page, nomeDoMemorial);
    ctx.verificar("antes de restaurar, o cartão mostra o memorial", (await memorialAntes.count()) > 0 && (await ctx.visivelRolando(memorialAntes)), `contagem=${await memorialAntes.count()}`);

    const id = await ctx.conversaAberta();
    // O memorial RETIDO no disco é a condição para a restauração ter o que
    // devolver: sem ele, o botão cinza depois do F5 seria o desfecho certo.
    const retido = await ctx.esperar(async () => Boolean((await ctx.lerConversa(id))?.memorial?.blobKey), 20_000, 500);
    ctx.verificar("o memorial está retido no disco da conversa", Boolean(id) && retido, `id=${id}`);
    await page.waitForTimeout(1500);

    // ── 1. A segunda aba abre sozinha a última conversa ──────────────────────
    const aba2 = await ctx.abrirOutraAba();
    const auditoriasDaAba2 = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/audit", aba2);
    const abriuNaAba2 = await ctx.esperar(async () => (await ctx.conversaAberta(aba2)) === id && (await aba2.getByText(/Li as primeiras páginas/).count()) > 0, 30_000, 500);
    ctx.verificar("a aba 2 abriu a mesma conversa, com a leitura do memorial", abriuNaAba2, `aberta=${await ctx.conversaAberta(aba2)} esperada=${id}`);
    const naAba2 = await esperarAuditarHabilitado(aba2, 20_000);
    const botaoDaAba2 = aba2.getByRole("button", { name: /^Auditar$/ }).last();
    ctx.verificar(
      "na aba 2, o Auditar habilita em até 20s, visível de verdade",
      naAba2.ok && (await botaoDaAba2.isEnabled().catch(() => false)) && (await ctx.visivelRolando(botaoDaAba2)),
      naAba2.linha.join(" → "),
    );
    const memorialNaAba2 = memorialNoCartao(aba2, nomeDoMemorial);
    ctx.verificar("na aba 2, o cartão mostra o memorial retido", (await memorialNaAba2.count()) > 0 && (await ctx.visivelRolando(memorialNaAba2)), `contagem=${await memorialNaAba2.count()}`);
    auditoriasDaAba2.parar();
    ctx.verificar("a aba 2 não gastou nada", auditoriasDaAba2.total() === 0, `POSTs /api/audit=${auditoriasDaAba2.total()}`);
    await aba2.close();

    // ── 2. F5 na aba original ────────────────────────────────────────────────
    await page.bringToFront();
    await page.reload({ waitUntil: "domcontentloaded" });
    const restaurou = await ctx.esperar(async () => (await ctx.conversaAberta()) === id && (await page.getByText(/Li as primeiras páginas/).count()) > 0, 30_000, 500);
    ctx.verificar("depois do F5 a mesma conversa volta, com a leitura do memorial", restaurou, `aberta=${await ctx.conversaAberta()} esperada=${id}`);
    const depoisDoF5 = await esperarAuditarHabilitado(page, 20_000);
    const botao = page.getByRole("button", { name: /^Auditar$/ }).last();
    ctx.verificar(
      "depois do F5, o Auditar habilita em até 20s, visível de verdade",
      depoisDoF5.ok && (await botao.isEnabled().catch(() => false)) && (await ctx.visivelRolando(botao)),
      depoisDoF5.linha.join(" → "),
    );
    const memorialNaAba1 = memorialNoCartao(page, nomeDoMemorial);
    ctx.verificar("depois do F5, o cartão mostra o memorial retido", (await memorialNaAba1.count()) > 0 && (await ctx.visivelRolando(memorialNaAba1)), `contagem=${await memorialNaAba1.count()}`);
    // O botão pode ficar habilitado por um instante e apagar em seguida (a
    // corrida suspeita). Um segundo depois ele ainda tem de estar lá.
    await page.waitForTimeout(1500);
    const aindaHabilitado = await estadoDoAuditar(page);
    ctx.verificar("e continua habilitado 1,5s depois", aindaHabilitado.rotulo === "Auditar" && aindaHabilitado.habilitado, JSON.stringify(aindaHabilitado));

    if (!depoisDoF5.ok) return; // sem botão clicável, o resto só repetiria a falha

    const auditorias = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/audit");
    await botao.click();
    const ver = await ctx.esperarParecer(1, 180_000).catch(() => page.getByRole("button", { name: /Ver o parecer/ }));
    auditorias.parar();
    ctx.verificar("o clique depois do F5 manda UMA auditoria ao servidor", auditorias.total() === 1, `POSTs /api/audit=${auditorias.total()}`);
    ctx.verificar("e o parecer aparece, visível de verdade", (await ver.count()) === 1 && (await ctx.visivelRolando(ver)), `botões Ver o parecer=${await ver.count()}`);
    await page.waitForTimeout(1500);
    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "uma auditoria, concluída no banco",
      registradas.length === 1 && linhas.length === 1 && linhas[0].status === "COMPLETED",
      `registradas=${registradas.length} ${JSON.stringify(linhas)}`,
    );
  },
};
