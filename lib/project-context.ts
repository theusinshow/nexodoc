import type { ProjectStatus } from "@prisma/client";

import { assertProjectAccess, getUserActor } from "@/lib/project-store";

export type ProjectContext = {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
};

type SessionUserIdentity = {
  email?: string | null;
  name?: string | null;
};

export async function getProjectContextForUser(
  projectId: string | undefined,
  user: SessionUserIdentity,
): Promise<ProjectContext | null> {
  if (!projectId || !user.email) {
    return null;
  }

  try {
    const actor = await getUserActor(user.email, user.name);
    const project = await assertProjectAccess(projectId, actor);

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      client: project.client,
      description: project.description,
      status: project.status,
    };
  } catch {
    return null;
  }
}
