// C1 — soltar de novo o memorial que a conversa já tem. Decidido pelo Matheus
// em 15/09/2026: deduplicar por nome de arquivo, a mesma regra das pranchas.
// Esperado: um chip, uma "Anexei o memorial", uma "Li as primeiras páginas", e
// no máximo uma linha curta dizendo que o memorial já está na conversa.
//
// As mensagens são contadas NO DISCO da conversa aberta (o que volta num F5), e
// o chip pelo botão de remover, que cada anexo tem um.
import path from "node:path";

export default {
  id: "c1",
  area: "conversas",
  titulo: "o mesmo memorial solto duas vezes fica um memorial só",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const nome = path.basename(f.memorialCurto);
    const chip = ctx.page.getByRole("button", { name: `Remover ${nome}` });

    const contar = async () => {
      const conversa = await ctx.lerConversa(await ctx.conversaAberta());
      const mensagens = conversa?.messages ?? [];
      return {
        chips: await chip.count(),
        anexei: mensagens.filter((m) => String(m.content ?? "").startsWith(`Anexei o memorial — ${nome}`)).length,
        li: mensagens.filter((m) => String(m.content ?? "").startsWith("Li as primeiras páginas")).length,
        memorial: conversa?.memorial?.name ?? null,
      };
    };

    await ctx.anexar([f.memorialCurto]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await ctx.page.waitForTimeout(1500);
    const primeira = await contar();
    // Sem esta linha, "continua um chip" lá embaixo poderia ser "nunca houve chip".
    ctx.verificar(
      "primeiro anexo: um chip, uma 'Anexei o memorial', uma 'Li as primeiras páginas'",
      primeira.chips === 1 && primeira.anexei === 1 && primeira.li === 1 && primeira.memorial === nome,
      JSON.stringify(primeira),
    );

    await ctx.anexar([f.memorialCurto]);
    const linha = ctx.page.getByText(`O memorial ${nome} já está nesta conversa — não li de novo.`);
    await linha.first().waitFor({ timeout: 30_000 }).catch(() => {});
    // Passa da janela do debounce (500ms) e de uma segunda leitura que ainda estivesse chegando.
    await ctx.page.waitForTimeout(4000);
    const segunda = await contar();

    ctx.verificar("segundo anexo: continua um chip", segunda.chips === 1, JSON.stringify(segunda));
    ctx.verificar("segundo anexo: continua uma 'Anexei o memorial'", segunda.anexei === 1, JSON.stringify(segunda));
    ctx.verificar("segundo anexo: continua uma 'Li as primeiras páginas'", segunda.li === 1, JSON.stringify(segunda));
    ctx.verificar("o memorial retido é o mesmo", segunda.memorial === nome, JSON.stringify(segunda));
    ctx.verificar("a linha curta diz que o memorial já está na conversa, visível de verdade", (await linha.count()) === 1 && (await ctx.visivelRolando(linha)), `contagem=${await linha.count()}`);
  },
};
