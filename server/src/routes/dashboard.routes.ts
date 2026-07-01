import { Router } from 'express';
import { query } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { requireProjectRole } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

const resolveProjectId = (req: { params: Record<string, string> }) => req.params.projectId;

// Aggregated metrics for a project dashboard.
router.get(
  '/projects/:projectId/dashboard',
  requireProjectRole('viewer', resolveProjectId),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;

    const statusCounts = await query(
      `SELECT status, COUNT(*)::int AS count FROM tasks WHERE project_id = $1 GROUP BY status`,
      [projectId]
    );

    const priorityCounts = await query(
      `SELECT priority, COUNT(*)::int AS count FROM tasks WHERE project_id = $1 GROUP BY priority`,
      [projectId]
    );

    // Workload distribution: open tasks + story points per assignee.
    const workload = await query(
      `SELECT u.id, u.name,
              COUNT(*) FILTER (WHERE t.status <> 'done')::int AS open_tasks,
              COALESCE(SUM(t.story_points) FILTER (WHERE t.status <> 'done'), 0)::int AS open_points
       FROM tasks t JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       GROUP BY u.id, u.name
       ORDER BY open_tasks DESC`,
      [projectId]
    );

    const [totals] = await query<{ total: number; done: number; points: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'done')::int AS done,
              COALESCE(SUM(story_points), 0)::int AS points
       FROM tasks WHERE project_id = $1`,
      [projectId]
    );

    const completionRate = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

    res.json({
      totals: { ...totals, completionRate },
      statusCounts,
      priorityCounts,
      workload,
    });
  })
);

export default router;
