// C1 — soltar de novo o memorial que a conversa já tem. Decidido pelo Matheus
// em 15/09/2026: deduplicar. Refinado em 15/09/2026: mesmo nome e mesmo
// conteúdo; mesmo nome com conteúdo novo é revisão e troca.
// Esperado: um chip, uma "Anexei o memorial", uma "Li as primeiras páginas", e
// no máximo uma linha curta dizendo que o memorial já está na conversa. Depois,
// a REVISÃO (mesmo nome, bytes novos) entra: "Troquei o memorial pela versão
// nova", o memorial é lido de novo e continua um chip só.
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

    // A REVISÃO: mesmo nome, outro conteúdo. Antes do refinamento ela era
    // ignorada como repetida e a auditoria rodaria na versão velha.
    ctx.verificar("controle: a revisão tem o mesmo nome", path.basename(f.memorialCurtoRevisado) === nome, f.memorialCurtoRevisado);
    await ctx.anexar([f.memorialCurtoRevisado]);
    const troquei = ctx.page.getByText("Troquei o memorial pela versão nova");
    await troquei.first().waitFor({ timeout: 30_000 }).catch(() => {});
    // A revisão é lida de novo: espera a segunda "Anexei" no disco, não um relógio.
    await ctx.esperar(async () => (await contar()).li === 2, 120_000).catch(() => {});
    const terceira = await contar();
    ctx.verificar("revisão: 'Troquei o memorial pela versão nova', uma vez, visível de verdade", (await troquei.count()) === 1 && (await ctx.visivelRolando(troquei)), `contagem=${await troquei.count()}`);
    ctx.verificar("revisão: a versão nova é lida (duas 'Anexei', duas 'Li')", terceira.anexei === 2 && terceira.li === 2, JSON.stringify(terceira));
    ctx.verificar("revisão: troca o chip, continua um só", terceira.chips === 1, JSON.stringify(terceira));
    ctx.verificar("revisão: não diz que já estava na conversa", (await linha.count()) === 1, `contagem=${await linha.count()}`);
  },
};
