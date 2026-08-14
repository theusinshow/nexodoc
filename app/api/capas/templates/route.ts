import { NextResponse } from "next/server";
import { getTemplateRegistry, getTemplateLayout } from "@/server/templates/registry";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export async function GET() {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
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
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
