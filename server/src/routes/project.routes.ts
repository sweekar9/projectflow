import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { requireProjectRole } from '../middleware/rbac';
import { logActivity } from '../services/activity.service';
import { notify } from '../services/notification.service';

const router = Router();
router.use(authenticate);

const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1).max(10),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

// List projects the current user belongs to.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await query(
      `SELECT p.id, p.name, p.key, p.description, p.owner_id, p.created_at, m.role
       FROM projects p
       JOIN memberships m ON m.project_id = p.id
       WHERE m.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user!.id]
    );
    res.json({ projects });
  })
);

// Create a project (creator becomes owner).
router.post(
  '/',
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, key, description } = req.body as z.infer<typeof createProjectSchema>;
    const userId = req.user!.id;

    const project = await withTransaction(async (run) => {
      const [p] = await run<{ id: string }>(
        'INSERT INTO projects (name, key, description, owner_id) VALUES ($1,$2,$3,$4) RETURNING id, name, key, description, owner_id, created_at',
        [name, key.toUpperCase(), description ?? null, userId]
      );
      await run('INSERT INTO memberships (project_id, user_id, role) VALUES ($1,$2,$3)', [p.id, userId, 'owner']);
      return p;
    });

    await logActivity({ projectId: (project as any).id, actorId: userId, verb: 'created', entity: 'project', entityId: (project as any).id });
    res.status(201).json({ project });
  })
);

// Get a single project with its members.
router.get(
  '/:projectId',
  requireProjectRole('viewer'),
  asyncHandler(async (req, res) => {
    const project = await queryOne(
      'SELECT id, name, key, description, owner_id, created_at FROM projects WHERE id = $1',
      [req.params.projectId]
    );
    if (!project) throw new HttpError(404, 'Project not found');

    const members = await query(
      `SELECT u.id, u.name, u.email, m.role
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.projectId]
    );
    res.json({ project, members });
  })
);

// Add a member by email (admin+).
router.post(
  '/:projectId/members',
  requireProjectRole('admin'),
  validateBody(addMemberSchema),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body as z.infer<typeof addMemberSchema>;
    const projectId = req.params.projectId;

    const target = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (!target) throw new HttpError(404, 'No user with that email');

    const existing = await queryOne('SELECT id FROM memberships WHERE project_id = $1 AND user_id = $2', [projectId, target.id]);
    if (existing) throw new HttpError(409, 'User already a member');

    const [membership] = await query(
      'INSERT INTO memberships (project_id, user_id, role) VALUES ($1,$2,$3) RETURNING id, project_id, user_id, role',
      [projectId, target.id, role]
    );

    await logActivity({ projectId, actorId: req.user!.id, verb: 'added', entity: 'member', entityId: target.id, metadata: { email, role } });
    await notify({ userId: target.id, projectId, message: `You were added to a project as ${role}`, link: `/board/${projectId}` });

    res.status(201).json({ membership });
  })
);

// Activity feed for a project.
router.get(
  '/:projectId/activity',
  requireProjectRole('viewer'),
  asyncHandler(async (req, res) => {
    const activities = await query(
      `SELECT a.id, a.verb, a.entity, a.entity_id, a.metadata, a.created_at, u.name AS actor_name
       FROM activities a JOIN users u ON u.id = a.actor_id
       WHERE a.project_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [req.params.projectId]
    );
    res.json({ activities });
  })
);

export default router;
