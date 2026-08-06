import { NextResponse } from "next/server";

import {
  getTemplateLayout,
  getTemplateOdtPath,
  getTemplateRegistry,
} from "@/server/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SAÚDE — o que o container precisa provar antes de receber tráfego.
 *
 * Não é um `{ ok: true }`: isso só diz que o Node subiu, e o Node subir nunca
 * foi o problema aqui. Este software falha de outro jeito, e o jeito é
 * silencioso: **os modelos ODT não vêm no pacote.** As rotas os leem do disco
 * com o caminho montado por `process.cwd()`, que o empacotador não enxerga. O
 * app sobe perfeito, a tela abre, e a geração só falha quando alguém tenta
 * gerar. Já aconteceu com `/api/capas/templates`.
 *
 * Por isso a checagem vai até o fim da corrente:
 *
 * 1. lê os `config.json` — 503 se não houver nenhuma prefeitura;
 * 2. confirma que o `.odt` de CADA uma existe no disco — o registro se contenta
 *    com o `config.json`, então listar prefeituras não prova nada sobre o
 *    modelo;
 * 3. abre o primeiro `.odt` e lê o layout — prova o zip, o `content.xml` e o
 *    leitor de uma vez. Depois da primeira vez sai do cache por data do
 *    arquivo, então repetir a cada 30s não custa.
 *
 * O conversor de PDF entra como INFORMAÇÃO, não como veredito: sem ele o
 * software ainda entrega ODT, e derrubar o container por isso seria pior.
 *
 * O banco também fica de fora, de propósito: a migração roda antes do processo
 * subir (`migrate deploy` no CMD), e uma consulta a cada 30 segundos por health
 * check é custo sem informação nova.
 */
export async function GET() {
  const detalhes: Record<string, unknown> = {
    conversorPdf: process.env.DOCUMENT_CONVERTER_URL
      ? "servico externo"
      : process.env.LIBREOFFICE_PATH
        ? "libreoffice local"
        : "AUSENTE — só sai ODT",
  };

  function fora(motivo: string) {
    return NextResponse.json({ ok: false, motivo, ...detalhes }, { status: 503 });
  }

  try {
    const templates = await getTemplateRegistry();
    detalhes.prefeituras = templates.length;

    if (templates.length === 0) {
      return fora("nenhum modelo de capa no pacote");
    }

    const semOdt: string[] = [];
    for (const template of templates) {
      if (!(await getTemplateOdtPath(template.id))) semOdt.push(template.id);
    }
    if (semOdt.length > 0) {
      detalhes.semOdt = semOdt;
      return fora(`modelo ODT ausente: ${semOdt.join(", ")}`);
    }

    const layout = await getTemplateLayout(templates[0].id);
    if (!layout || layout.length === 0) {
      return fora(`não consegui ler o layout de ${templates[0].id}`);
    }
    detalhes.modelos = templates.map((t) => t.id);
    detalhes.paragrafosDoPrimeiro = layout.length;
  } catch (err) {
    return fora(err instanceof Error ? err.message : "falha ao ler os modelos");
  }

  return NextResponse.json({ ok: true, ...detalhes });
}
