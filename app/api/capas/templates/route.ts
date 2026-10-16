import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { getTemplateRegistry, getTemplateLayout } from "@/server/templates/registry";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { Actor } from "@/lib/actor";
import { projetoDoPedido } from "@/lib/projeto-do-pedido";
import { modeloDeCapaResolvido, templateDoModeloDoProjeto } from "@/server/modelo-capa";
import { lerLayoutDoModelo } from "@/server/odt/layout";
import { projetoDoEscritorio } from "@/server/pranchas";

export async function GET(req: NextRequest) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  try {
    const registry = await getTemplateRegistry();
    /*
     * O LAYOUT vai junto: o cliente já busca esta rota para montar o seletor de
     * prefeitura, e o frame do documento precisa da estrutura do modelo para se
     * desenhar. Endpoint separado seria uma ida a mais para ligar sem ganho.
     *
     * Modelo ilegível não derruba a lista: ele volta com `layout: []`, e o card
     * cai para a lista de rótulo/valor. Degradar é melhor que sumir.
     */
    const templates = await Promise.all(
      registry.map(async (t) => ({
        ...t,
        layout: (await getTemplateLayout(t.id).catch(() => null)) ?? [],
      })),
    );

    /*
     * O MODELO DE CAPA DO PROJETO (16/10/2026), na frente, quando a conversa
     * está num projeto deste escritório e ele tem um. Falha aqui não derruba a
     * lista: sem o modelo do projeto, sobram as prefeituras, como antes.
     */
    const projeto = projetoDoPedido(req.headers);
    if (projeto) {
      const doProjeto = await (async () => {
        if (!(await projetoDoEscritorio(projeto, actor.organizationId))) return null;
        const resolvido = await modeloDeCapaResolvido(projeto, actor.organizationId);
        if (!resolvido) return null;
        const xml = await (await JSZip.loadAsync(resolvido.bytes)).file("content.xml")?.async("string");
        return {
          ...templateDoModeloDoProjeto(projeto, resolvido.ficha),
          layout: xml ? lerLayoutDoModelo(xml) : [],
        };
      })().catch((err) => {
        console.warn("[capas/templates] modelo do projeto indisponível:", err);
        return null;
      });
      if (doProjeto) templates.unshift(doProjeto);
    }

    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
