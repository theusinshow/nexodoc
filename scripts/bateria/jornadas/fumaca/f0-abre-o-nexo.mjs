// Fumaça: a fundação inteira funciona (login, IA simulada, IndexedDB, banco).
// Se esta falhar, nenhuma outra jornada diz nada.
export default {
  id: "f0",
  area: "fumaca",
  titulo: "o Nexo abre, loga e a IA simulada obedece",
  async rodar(ctx) {
    await ctx.login();
    ctx.verificar("entrou no /nexo", ctx.page.url().includes("/nexo"), ctx.page.url());

    await ctx.ia.fila("audit-global", "abortar");
    const fila = await (await ctx.page.request.get(`${ctx.base}/api/teste/ia`)).json();
    ctx.verificar("a fila da IA simulada aceitou o comportamento", fila.fila?.length === 1, JSON.stringify(fila));
    await ctx.ia.limpar();

    const conversas = await ctx.indexeddb.lerConversas();
    ctx.verificar("o IndexedDB do Nexo abre", Array.isArray(conversas));

    const usuarios = await ctx.banco.consultar(`select email from "User" where email = 'bateria@nexodoc.local'`);
    ctx.verificar("o usuário da bateria existe no banco de teste", usuarios.length === 1);
  },
};
