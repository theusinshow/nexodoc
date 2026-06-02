import { NextResponse } from "next/server";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";

export async function POST(request: Request) {
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
