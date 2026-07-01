import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { logActivity } from '../services/activity.service';

const router = Router();
router.use(authenticate);

const createCommentSchema = z.object({ body: z.string().min(1) });

async function taskProject(taskId: string): Promise<string> {
  const row = await queryOne<{ project_id: string }>('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!row) throw new HttpError(404, 'Task not found');
  return row.project_id;
}

async function assertMember(projectId: string, userId: string) {
  const m = await queryOne('SELECT id FROM memberships WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!m) throw new HttpError(403, 'Not a project member');
}

router.get(
  '/tasks/:taskId/comments',
  asyncHandler(async (req, res) => {
    const projectId = await taskProject(req.params.taskId);
    await assertMember(projectId, req.user!.id);
    const comments = await query(
      `SELECT c.id, c.body, c.created_at, u.name AS author_name, u.id AS author_id
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [req.params.taskId]
    );
    res.json({ comments });
  })
);

router.post(
  '/tasks/:taskId/comments',
  validateBody(createCommentSchema),
  asyncHandler(async (req, res) => {
    const projectId = await taskProject(req.params.taskId);
    await assertMember(projectId, req.user!.id);
    const { body } = req.body as z.infer<typeof createCommentSchema>;

    const [comment] = await query(
      'INSERT INTO comments (task_id, author_id, body) VALUES ($1,$2,$3) RETURNING id, task_id, body, created_at',
      [req.params.taskId, req.user!.id, body]
    );
    await logActivity({ projectId, actorId: req.user!.id, verb: 'commented', entity: 'task', entityId: req.params.taskId });
    res.status(201).json({ comment });
  })
);

export default router;
