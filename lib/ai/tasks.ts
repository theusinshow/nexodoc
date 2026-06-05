import type { AiTaskPriority, AiTaskStatus, Prisma } from "@prisma/client";

import type { AiProvider, AiProviderFlow } from "@/lib/ai-providers";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { normalizeEmail } from "@/lib/project-store";

export type AiAgentName =
  | "auditor"
  | "ld-reader"
  | "volume-builder"
  | "project-assistant"
  | "supervisor"
  | "admin";

type CreateAiTaskArgs = {
  flow: AiProviderFlow;
  agent: AiAgentName | string;
  operation: string;
  provider?: AiProvider | null;
  model?: string | null;
  projectId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  inputHash?: string | null;
  inputSummary?: string | null;
  metadata?: Prisma.InputJsonValue;
  priority?: AiTaskPriority;
  maxAttempts?: number;
};

type StartAiTaskArgs = {
  provider?: AiProvider | null;
  model?: string | null;
};

type CompleteAiTaskArgs = {
  outputSummary?: string | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  metadata?: Prisma.InputJsonValue;
  status?: Extract<AiTaskStatus, "SUCCEEDED" | "NEEDS_REVIEW">;
};

type FailAiTaskArgs = {
  error: unknown;
  metadata?: Prisma.InputJsonValue;
};

function trimString(value: string | null | undefined, maxLength: number) {
  return value?.trim().slice(0, maxLength) || null;
}

function normalizeMaxAttempts(value: number | undefined) {
  if (!Number.isFinite(value) || !value) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.floor(value)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1000)
    : String(error ?? "").slice(0, 1000);
}

export async function createAiTask(args: CreateAiTaskArgs) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const email = args.userEmail ? normalizeEmail(args.userEmail) : null;

  try {
    const task = await getPrisma().aiTask.create({
      data: {
        projectId: args.projectId || undefined,
        userId: args.userId || undefined,
        userEmail: email || undefined,
        flow: args.flow,
        agent: trimString(args.agent, 80) ?? "unknown",
        operation: trimString(args.operation, 120) ?? args.flow,
        provider: args.provider || undefined,
        model: trimString(args.model, 120),
        priority: args.priority ?? "NORMAL",
        inputHash: trimString(args.inputHash, 128),
        inputSummary: trimString(args.inputSummary, 2000),
        relatedType: trimString(args.relatedType, 80),
        relatedId: trimString(args.relatedId, 128),
        maxAttempts: normalizeMaxAttempts(args.maxAttempts),
        metadata: args.metadata ?? undefined,
      },
      select: { id: true },
    });

    return task.id;
  } catch (error) {
    console.error("[ai-task] falha ao criar tarefa", error);
    return null;
  }
}

export async function startAiTask(taskId: string | null | undefined, args: StartAiTaskArgs = {}) {
  if (!taskId || !isDatabaseConfigured()) {
    return;
  }

  try {
    await getPrisma().aiTask.update({
      where: { id: taskId },
      data: {
        status: "RUNNING",
        provider: args.provider || undefined,
        model: trimString(args.model, 120),
        startedAt: new Date(),
        finishedAt: null,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });
  } catch (error) {
    console.error("[ai-task] falha ao iniciar tarefa", error);
  }
}

export async function completeAiTask(
  taskId: string | null | undefined,
  args: CompleteAiTaskArgs = {},
) {
  if (!taskId || !isDatabaseConfigured()) {
    return;
  }

  try {
    const usage = await getPrisma().aiUsageEvent.aggregate({
      where: { aiTaskId: taskId },
      _sum: { estimatedCostUsd: true },
    });

    await getPrisma().aiTask.update({
      where: { id: taskId },
      data: {
        status: args.status ?? "SUCCEEDED",
        outputSummary: trimString(args.outputSummary, 2000),
        estimatedCostUsd: args.estimatedCostUsd ?? usage._sum.estimatedCostUsd ?? undefined,
        actualCostUsd: args.actualCostUsd ?? undefined,
        metadata: args.metadata ?? undefined,
        finishedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    console.error("[ai-task] falha ao concluir tarefa", error);
  }
}

export async function failAiTask(taskId: string | null | undefined, args: FailAiTaskArgs) {
  if (!taskId || !isDatabaseConfigured()) {
    return;
  }

  try {
    await getPrisma().aiTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        lastError: getErrorMessage(args.error),
        metadata: args.metadata ?? undefined,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[ai-task] falha ao marcar tarefa como falha", error);
  }
}

export async function cancelAiTask(taskId: string | null | undefined, reason?: string) {
  if (!taskId || !isDatabaseConfigured()) {
    return;
  }

  try {
    await getPrisma().aiTask.update({
      where: { id: taskId },
      data: {
        status: "CANCELED",
        lastError: trimString(reason, 1000),
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[ai-task] falha ao cancelar tarefa", error);
  }
}
