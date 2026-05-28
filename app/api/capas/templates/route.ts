import { NextResponse } from "next/server";
import { getTemplateRegistry } from "@/server/templates/registry";

export async function GET() {
  try {
    const templates = await getTemplateRegistry();
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
