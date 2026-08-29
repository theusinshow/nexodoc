/**
 * Semeia uma conversa com folhas de verdade no canvas do Nexo.
 *
 * Nasceu duplicado dentro da prova do teclado e virou módulo quando a prova do
 * zoom precisou do MESMO cenário: duas cópias do cenário divergiriam, e aí as
 * duas provas mediriam telas diferentes achando que medem a mesma.
 *
 * NÃO usa o projeto de exemplo. Ele é semeado só na primeira visita e a barra
 * lateral já vem com dezenas de conversas do servidor — a prova que dependia
 * dele não o achava, e o sintoma ("sem folhas") apontava para o canvas em vez de
 * para o cenário.
 */
export async function semearCanvas(
  page,
  { conversationId, titulo, folhas, conferencia },
) {
  await page.evaluate(
    async ({
      convId,
      tituloDaConversa,
      listaDeFolhas,
      resultadoDaConferencia,
    }) => {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const agora = Date.now();
      const base = {
        total: 2,
        arquivo: null,
        cliente: "Prefeitura Municipal de Criciuma",
        obra: "Escola da prova do canvas",
        fase: "Projeto Executivo",
        data: "MARCO/2026",
        confianca: "alta",
      };
      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: tituloDaConversa,
          createdAt: agora,
          updatedAt: agora,
          messages: [
            {
              id: "m1",
              role: "assistant",
              content: `Li ${listaDeFolhas.length} folhas.`,
            },
          ],
          seloResults: listaDeFolhas.map((f) => ({
            /*
             * `arquivoDoUpload` e `pagina` são escapes para o cenário em que
             * várias folhas vêm do MESMO PDF — é ele que aciona a reconciliação
             * por ordem de página, e sem poder encená-lo não daria para provar
             * a origem `ordem`.
             */
            fileName:
              f.arquivoDoUpload ??
              `qa_${f.disciplina.slice(0, 3).toLowerCase()}_${f.folha}.pdf`,
            pageNumber: f.pagina ?? 1,
            pageCount: 1,
            extraction: {
              ...base,
              disciplina: f.disciplina,
              folha: f.folha,
              numeroFolha: `0${f.folha}/02`,
              conteudo: f.conteudo,
              arquivo: f.arquivo ?? null,
            },
            usage: 0,
          })),
          /*
           * A conferência entra como ARTEFATO da conversa, que é onde ela mora
           * de verdade (`saveResult` com `kind: "conferencia"`). Injetá-la por
           * prop faria a prova medir um caminho que o produto não tem.
           */
          results: resultadoDaConferencia
            ? [
                {
                  artifactId: "conferencia:qa",
                  kind: "conferencia",
                  summary: `Conferência — ${resultadoDaConferencia.veredito}`,
                  files: [],
                  payload: resultadoDaConferencia,
                  generatedAt: agora,
                },
              ]
            : [],
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    {
      convId: conversationId,
      tituloDaConversa: titulo,
      listaDeFolhas: folhas,
      resultadoDaConferencia: conferencia ?? null,
    },
  );

  // A barra lateral só relê na montagem — sem recarregar, a conversa semeada
  // não aparece para ser aberta.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const pular = page.getByRole("button", { name: /pular/i });
  if (await pular.count()) await pular.first().click();
  await page.getByText(titulo).first().click();
  await page.waitForTimeout(1500);
  const abaDoMapa = page
    .getByRole("button", { name: /mapa do volume/i })
    .first();
  if (await abaDoMapa.count()) {
    await abaDoMapa.click();
    await page.waitForTimeout(1200);
  }
}

/** Quatro folhas em duas disciplinas — o mínimo para haver o que percorrer. */
export const FOLHAS_DE_PROVA = [
  {
    disciplina: "Arquitetura",
    folha: 1,
    conteudo: "Planta baixa",
    arquivo: "qa_arq_001_a",
  },
  {
    disciplina: "Arquitetura",
    folha: 2,
    conteudo: "Cortes e fachadas",
    arquivo: "qa_arq_002_a",
  },
  {
    disciplina: "Estrutural",
    folha: 1,
    conteudo: "Formas - fundacao",
    arquivo: "qa_est_001_a",
  },
  {
    disciplina: "Estrutural",
    folha: 2,
    conteudo: "Armacao - pilares",
    arquivo: "qa_est_002_a",
  },
];
