import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type UsageResult = {
  input_tokens?: number;
  output_tokens?: number;
  input_cached_tokens?: number;
  num_model_requests?: number;
  model?: string | null;
};

type UsageBucket = {
  start_time: number;
  end_time: number;
  results?: UsageResult[];
};

type CostsResult = {
  amount?: {
    value?: number;
    currency?: string;
  };
  line_item?: string | null;
  project_id?: string | null;
};

type CostsBucket = {
  start_time: number;
  end_time: number;
  results?: CostsResult[];
};

function getAllowedOrigin(request: Request) {
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

function withCors(response: NextResponse, request: Request) {
  response.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(request));
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

function jsonError(request: Request, message: string, status = 400) {
  return withCors(NextResponse.json({ error: message }, { status }), request);
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function getDays(request: Request) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);

  if (!Number.isFinite(days)) {
    return 7;
  }

  return Math.min(30, Math.max(1, Math.floor(days)));
}

function formatDay(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchOpenAIPage<T>(
  path: string,
  params: URLSearchParams,
  adminKey: string,
) {
  const url = new URL(`https://api.openai.com${path}`);
  params.forEach((value, key) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Nao foi possivel consultar a OpenAI.",
    );
  }

  return payload?.data ?? [];
}

function summarizeUsage(buckets: UsageBucket[]) {
  const byDay = new Map<
    string,
    {
      date: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      requests: number;
    }
  >();
  const byModel = new Map<
    string,
    {
      model: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      requests: number;
    }
  >();

  for (const bucket of buckets) {
    const date = formatDay(bucket.start_time);
    const day = byDay.get(date) ?? {
      date,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      requests: 0,
    };

    for (const result of bucket.results ?? []) {
      const modelName = result.model ?? "sem modelo";
      const model = byModel.get(modelName) ?? {
        model: modelName,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        requests: 0,
      };

      const inputTokens = result.input_tokens ?? 0;
      const outputTokens = result.output_tokens ?? 0;
      const cachedTokens = result.input_cached_tokens ?? 0;
      const requests = result.num_model_requests ?? 0;

      day.inputTokens += inputTokens;
      day.outputTokens += outputTokens;
      day.cachedTokens += cachedTokens;
      day.requests += requests;
      model.inputTokens += inputTokens;
      model.outputTokens += outputTokens;
      model.cachedTokens += cachedTokens;
      model.requests += requests;

      byModel.set(modelName, model);
    }

    byDay.set(date, day);
  }

  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const models = [...byModel.values()].sort((a, b) => b.requests - a.requests);

  return {
    daily,
    models,
    totals: daily.reduce(
      (total, day) => ({
        inputTokens: total.inputTokens + day.inputTokens,
        outputTokens: total.outputTokens + day.outputTokens,
        cachedTokens: total.cachedTokens + day.cachedTokens,
        requests: total.requests + day.requests,
      }),
      {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        requests: 0,
      },
    ),
  };
}

function summarizeCosts(buckets: CostsBucket[]) {
  const byDay = new Map<string, { date: string; amount: number; currency: string }>();
  const byLineItem = new Map<
    string,
    {
      lineItem: string;
      amount: number;
      currency: string;
    }
  >();

  for (const bucket of buckets) {
    const date = formatDay(bucket.start_time);
    const day = byDay.get(date) ?? { date, amount: 0, currency: "usd" };

    for (const result of bucket.results ?? []) {
      const amount = result.amount?.value ?? 0;
      const currency = result.amount?.currency ?? "usd";
      const lineItemName = result.line_item ?? "Total";
      const lineItem = byLineItem.get(lineItemName) ?? {
        lineItem: lineItemName,
        amount: 0,
        currency,
      };

      day.amount += amount;
      day.currency = currency;
      lineItem.amount += amount;
      lineItem.currency = currency;

      byLineItem.set(lineItemName, lineItem);
    }

    byDay.set(date, day);
  }

  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    daily,
    lineItems: [...byLineItem.values()].sort((a, b) => b.amount - a.amount),
    total: daily.reduce(
      (total, day) => ({
        amount: total.amount + day.amount,
        currency: day.currency || total.currency,
      }),
      { amount: 0, currency: "usd" },
    ),
  };
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();
  const openAIAdminKey = process.env.OPENAI_ADMIN_KEY?.trim();

  if (!adminToken) {
    return jsonError(request, "NEXODOC_ADMIN_TOKEN nao configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError(request, "Acesso admin negado.", 401);
  }

  if (!openAIAdminKey) {
    return jsonError(request, "OPENAI_ADMIN_KEY nao configurada.", 500);
  }

  try {
    const days = getDays(request);
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;
    const baseParams = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: "1d",
      limit: String(days),
    });
    const usageParams = new URLSearchParams(baseParams);
    usageParams.append("group_by", "model");
    const costParams = new URLSearchParams(baseParams);
    costParams.append("group_by", "line_item");

    const [usageBuckets, costBuckets] = await Promise.all([
      fetchOpenAIPage<UsageBucket>(
        "/v1/organization/usage/completions",
        usageParams,
        openAIAdminKey,
      ),
      fetchOpenAIPage<CostsBucket>(
        "/v1/organization/costs",
        costParams,
        openAIAdminKey,
      ),
    ]);

    return withCors(
      NextResponse.json({
        range: {
          days,
          startTime,
          endTime,
        },
        usage: summarizeUsage(usageBuckets),
        costs: summarizeCosts(costBuckets),
        generatedAt: new Date().toISOString(),
      }),
      request,
    );
  } catch (error) {
    return jsonError(
      request,
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar uso administrativo.",
      500,
    );
  }
}
