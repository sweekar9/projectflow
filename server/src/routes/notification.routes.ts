import { Router } from 'express';
import { query } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// List current user's notifications.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await query(
      'SELECT id, project_id, message, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.id]
    );
    res.json({ notifications });
  })
);

// Mark one notification read.
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    res.json({ ok: true });
  })
);

// Mark all read.
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user!.id]);
    res.json({ ok: true });
  })
);

export default router;
