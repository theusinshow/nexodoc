import { NextResponse } from "next/server";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export async function POST(request: Request) {
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

  return withVolumeCors(
    NextResponse.json(
      { error: "Extract endpoint not implemented yet." },
      { status: 501 }
    ),
    request
  );
}

export function OPTIONS(request: Request) {
  return volumeOptions(request, "POST, OPTIONS");
}
