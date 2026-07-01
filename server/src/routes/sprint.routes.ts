import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { requireProjectRole } from '../middleware/rbac';
import { logActivity } from '../services/activity.service';

const router = Router({ mergeParams: true });
router.use(authenticate);

const resolveProjectId = (req: { params: Record<string, string> }) => req.params.projectId;

const createSprintSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateSprintSchema = z.object({
  status: z.enum(['planned', 'active', 'completed']),
});

// List sprints in a project.
router.get(
  '/projects/:projectId/sprints',
  requireProjectRole('viewer', resolveProjectId),
  asyncHandler(async (req, res) => {
    const sprints = await query(
      'SELECT id, name, goal, status, start_date, end_date, created_at FROM sprints WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.projectId]
    );
    res.json({ sprints });
  })
);

// Create a sprint (member+).
router.post(
  '/projects/:projectId/sprints',
  requireProjectRole('member', resolveProjectId),
  validateBody(createSprintSchema),
  asyncHandler(async (req, res) => {
    const { name, goal, startDate, endDate } = req.body as z.infer<typeof createSprintSchema>;
    const [sprint] = await query(
      `INSERT INTO sprints (project_id, name, goal, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, goal, status, start_date, end_date, created_at`,
      [req.params.projectId, name, goal ?? null, startDate ?? null, endDate ?? null]
    );
    await logActivity({ projectId: req.params.projectId, actorId: req.user!.id, verb: 'created', entity: 'sprint', entityId: (sprint as any).id, metadata: { name } });
    res.status(201).json({ sprint });
  })
);

// Update sprint status (member+).
router.patch(
  '/sprints/:sprintId',
  validateBody(updateSprintSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof updateSprintSchema>;

    const sprint = await queryOne<{ project_id: string }>('SELECT project_id FROM sprints WHERE id = $1', [req.params.sprintId]);
    if (!sprint) throw new HttpError(404, 'Sprint not found');

    // Manual RBAC check because projectId comes from the sprint row.
    const membership = await queryOne<{ role: string }>(
      'SELECT role FROM memberships WHERE project_id = $1 AND user_id = $2',
      [sprint.project_id, req.user!.id]
    );
    if (!membership || membership.role === 'viewer') throw new HttpError(403, 'Requires member role or higher');

    const [updated] = await query(
      'UPDATE sprints SET status = $1 WHERE id = $2 RETURNING id, name, goal, status, start_date, end_date',
      [status, req.params.sprintId]
    );
    await logActivity({ projectId: sprint.project_id, actorId: req.user!.id, verb: 'updated', entity: 'sprint', entityId: req.params.sprintId, metadata: { status } });
    res.json({ sprint: updated });
  })
);

export default router;
