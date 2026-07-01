import { NextFunction, Request, Response } from 'express';
import { queryOne } from '../db/pool';
import { HttpError } from '../utils/asyncHandler';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

// Higher number = more privilege.
const RANK: Record<Role, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

/**
 * Ensures the authenticated user is a member of the project referenced by
 * `req.params.projectId` (or a resolver) and has at least `minRole`.
 * Attaches `req.membership` for downstream handlers.
 */
export function requireProjectRole(minRole: Role, resolveProjectId?: (req: Request) => string | undefined) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new HttpError(401, 'Not authenticated'));

      const projectId = resolveProjectId ? resolveProjectId(req) : req.params.projectId;
      if (!projectId) return next(new HttpError(400, 'Missing project id'));

      const membership = await queryOne<{ role: Role }>(
        'SELECT role FROM memberships WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );

      if (!membership) return next(new HttpError(403, 'You are not a member of this project'));
      if (RANK[membership.role] < RANK[minRole]) {
        return next(new HttpError(403, `Requires ${minRole} role or higher`));
      }

      (req as Request & { membership?: { role: Role; projectId: string } }).membership = {
        role: membership.role,
        projectId,
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
