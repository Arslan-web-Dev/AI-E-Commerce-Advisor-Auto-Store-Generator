/** Pure authorization check shared by Module 5 project-scoped read paths. */
export interface ProjectAccessContext {
  userId?: string | null;
  ownerId?: string | null;
  role?: string | null;
}

export function hasProjectAccess(context: ProjectAccessContext): boolean {
  if (!context.userId) return false;
  if (context.role === 'admin') return true;
  return Boolean(context.ownerId) && context.userId === context.ownerId;
}
