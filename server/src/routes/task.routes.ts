import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { requireProjectRole } from '../middleware/rbac';
import { logActivity } from '../services/activity.service';
import { notify } from '../services/notification.service';
import { emitToProject } from '../realtime/io';

const router = Router();
router.use(authenticate);

const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;

const resolveProjectId = (req: { params: Record<string, string> }) => req.params.projectId;

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['story', 'task', 'bug']).default('task'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(STATUSES).default('backlog'),
  storyPoints: z.number().int().nonnegative().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const moveTaskSchema = z.object({
  status: z.enum(STATUSES),
  position: z.number().int().nonnegative().default(0),
});

async function loadTaskProject(taskId: string): Promise<{ projectId: string }> {
  const row = await queryOne<{ project_id: string }>('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!row) throw new HttpError(404, 'Task not found');
  return { projectId: row.project_id };
}

async function assertRole(projectId: string, userId: string, min: 'viewer' | 'member') {
  const membership = await queryOne<{ role: string }>('SELECT role FROM memberships WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!membership) throw new HttpError(403, 'Not a project member');
  if (min === 'member' && membership.role === 'viewer') throw new HttpError(403, 'Requires member role or higher');
  return membership.role;
}

// Board view: tasks grouped by status column.
router.get(
  '/projects/:projectId/board',
  requireProjectRole('viewer', resolveProjectId),
  asyncHandler(async (req, res) => {
    const tasks = await query(
      `SELECT t.id, t.title, t.description, t.status, t.type, t.priority, t.story_points,
              t.sprint_id, t.assignee_id, t.position, u.name AS assignee_name
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.position ASC, t.created_at ASC`,
      [req.params.projectId]
    );

    const columns: Record<string, unknown[]> = {};
    for (const s of STATUSES) columns[s] = [];
    for (const t of tasks) columns[(t as any).status].push(t);

    res.json({ columns });
  })
);

// Create a task (member+).
router.post(
  '/projects/:projectId/tasks',
  requireProjectRole('member', resolveProjectId),
  validateBody(createTaskSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const body = req.body as z.infer<typeof createTaskSchema>;

    const [{ next_pos }] = await query<{ next_pos: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [projectId, body.status]
    );

    const [task] = await query(
      `INSERT INTO tasks (project_id, sprint_id, title, description, status, type, priority, story_points, assignee_id, reporter_id, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, description, status, type, priority, story_points, sprint_id, assignee_id, position`,
      [projectId, body.sprintId ?? null, body.title, body.description ?? null, body.status, body.type, body.priority, body.storyPoints ?? null, body.assigneeId ?? null, req.user!.id, next_pos]
    );

    await logActivity({ projectId, actorId: req.user!.id, verb: 'created', entity: 'task', entityId: (task as any).id, metadata: { title: body.title } });
    if (body.assigneeId && body.assigneeId !== req.user!.id) {
      await notify({ userId: body.assigneeId, projectId, message: `You were assigned "${body.title}"`, link: `/board/${projectId}` });
    }
    emitToProject(projectId, 'task:created', task);
    res.status(201).json({ task });
  })
);

// Update task fields (member+).
router.patch(
  '/tasks/:taskId',
  validateBody(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = await loadTaskProject(req.params.taskId);
    await assertRole(projectId, req.user!.id, 'member');

    const body = req.body as z.infer<typeof updateTaskSchema>;
    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      type: 'type',
      priority: 'priority',
      status: 'status',
      storyPoints: 'story_points',
      sprintId: 'sprint_id',
      assigneeId: 'assignee_id',
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in body) {
        sets.push(`${column} = $${idx++}`);
        values.push((body as Record<string, unknown>)[key]);
      }
    }
    if (sets.length === 0) throw new HttpError(400, 'No fields to update');
    sets.push(`updated_at = now()`);
    values.push(req.params.taskId);

    const [task] = await query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, title, description, status, type, priority, story_points, sprint_id, assignee_id, position`,
      values
    );

    await logActivity({ projectId, actorId: req.user!.id, verb: 'updated', entity: 'task', entityId: req.params.taskId, metadata: body as Record<string, unknown> });
    if (body.assigneeId && body.assigneeId !== req.user!.id) {
      await notify({ userId: body.assigneeId, projectId, message: `A task was assigned to you`, link: `/board/${projectId}` });
    }
    emitToProject(projectId, 'task:updated', task);
    res.json({ task });
  })
);

// Move a task between Kanban columns (member+).
router.patch(
  '/tasks/:taskId/move',
  validateBody(moveTaskSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = await loadTaskProject(req.params.taskId);
    await assertRole(projectId, req.user!.id, 'member');

    const { status, position } = req.body as z.infer<typeof moveTaskSchema>;
    const [task] = await query(
      'UPDATE tasks SET status = $1, position = $2, updated_at = now() WHERE id = $3 RETURNING id, status, position',
      [status, position, req.params.taskId]
    );

    await logActivity({ projectId, actorId: req.user!.id, verb: 'moved', entity: 'task', entityId: req.params.taskId, metadata: { status } });
    emitToProject(projectId, 'task:moved', task);
    res.json({ task });
  })
);

// Delete a task (member+).
router.delete(
  '/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const { projectId } = await loadTaskProject(req.params.taskId);
    await assertRole(projectId, req.user!.id, 'member');
    await query('DELETE FROM tasks WHERE id = $1', [req.params.taskId]);
    await logActivity({ projectId, actorId: req.user!.id, verb: 'deleted', entity: 'task', entityId: req.params.taskId });
    emitToProject(projectId, 'task:deleted', { id: req.params.taskId });
    res.status(204).send();
  })
);

export default router;
