// A2 — a REVISÃO dos achados trunca (`audit-validation: truncar`).
//
// Esperado (catálogo): o parecer sai, e "Revisão dos achados pela IA" aparece
// como etapa incompleta. O caminho no código, lido em 15/09/2026:
// `extractOutputText` (lib/ai-runner.ts) lança `incomplete_max_output_tokens`;
// o `catch` da validação (app/api/audit/route.ts, "Revisão dos achados pela
// IA") põe a passada em `degradacoes` e mantém os achados; e
// `incompletudeDoParecer` (lib/auditoria-incompleta.ts) cai no ramo genérico.
// Memorial curto e sem folha muda de propósito: com o 117_25 o aviso falaria
// de páginas não lidas, e a etapa ficaria escondida atrás dele.
export default {
  id: "a2",
  area: "auditoria",
  titulo: "revisão dos achados trunca: o parecer sai e diz a etapa que faltou",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-validation", "truncar");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    const verParecer = await ctx.esperarParecer(1);
    // O palco mostra o aviso inteiro; o cartão do chat, só título e explicação.
    await verParecer.last().click();
    await ctx.page.waitForTimeout(1500);

    const titulo = ctx.page.getByText("AUDITORIA INCOMPLETA", { exact: true });
    ctx.verificar("aviso de auditoria incompleta, visível de verdade", await ctx.visivelRolando(titulo), `contagem=${await titulo.count()}`);

    const explicacao = ctx.page.getByText(/Uma etapa da análise não completou \(Revisão dos achados pela IA\)/);
    ctx.verificar("a explicação nomeia a revisão, visível de verdade", await ctx.visivelRolando(explicacao), `contagem=${await explicacao.count()}`);

    const etapa = ctx.page.getByText("Etapa que falhou: Revisão dos achados pela IA");
    ctx.verificar("o palco lista a etapa que falhou, visível de verdade", await ctx.visivelRolando(etapa), `contagem=${await etapa.count()}`);

    const contagem = ctx.page.getByText(/contagem INCOMPLETA/);
    ctx.verificar("a contagem se declara incompleta, visível de verdade", await ctx.visivelRolando(contagem), `contagem=${await contagem.count()}`);

    const id = await ctx.conversaAberta();
    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar("uma auditoria registrada na conversa e achada no banco", registradas.length === 1 && linhas.length === 1, `registradas=${registradas.length} linhas=${linhas.length}`);
    const passadas = JSON.stringify(linhas[0]?.passadas ?? []);
    ctx.verificar("auditoria gravada como COMPLETED", linhas[0]?.status === "COMPLETED", linhas[0]?.status);
    ctx.verificar("a revisão está nas passadas incompletas gravadas", passadas.includes("Revisão dos achados pela IA"), passadas);
    ctx.verificar("a leitura global não entrou como falha", !passadas.includes("Leitura global"), passadas);
  },
};
