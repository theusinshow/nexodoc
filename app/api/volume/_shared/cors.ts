import { NextResponse } from "next/server";

const DEFAULT_METHODS = "GET, POST, OPTIONS";

export function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.NEXODOC_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin) {
    return allowedOrigins?.[0] ?? "*";
  }

  if (!allowedOrigins || allowedOrigins.length === 0) {
    return origin;
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

export function withVolumeCors(
  response: NextResponse,
  request: Request,
  methods = DEFAULT_METHODS
) {
  response.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(request));
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Vary", "Origin");

  return response;
}

export function volumeOptions(request: Request, methods = DEFAULT_METHODS) {
  return withVolumeCors(new NextResponse(null, { status: 204 }), request, methods);
}
