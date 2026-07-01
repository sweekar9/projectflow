import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { query, queryOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { logActivity } from '../services/activity.service';

const router = Router();
router.use(authenticate);

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

async function taskProject(taskId: string): Promise<string> {
  const row = await queryOne<{ project_id: string }>('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!row) throw new HttpError(404, 'Task not found');
  return row.project_id;
}

async function assertMember(projectId: string, userId: string) {
  const m = await queryOne('SELECT id FROM memberships WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!m) throw new HttpError(403, 'Not a project member');
}

// List attachments for a task.
router.get(
  '/tasks/:taskId/attachments',
  asyncHandler(async (req, res) => {
    const projectId = await taskProject(req.params.taskId);
    await assertMember(projectId, req.user!.id);
    const attachments = await query(
      'SELECT id, filename, original_name, mime_type, size_bytes, created_at FROM attachments WHERE task_id = $1 ORDER BY created_at DESC',
      [req.params.taskId]
    );
    res.json({ attachments });
  })
);

// Upload an attachment.
router.post(
  '/tasks/:taskId/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = await taskProject(req.params.taskId);
    await assertMember(projectId, req.user!.id);
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name must be "file")');

    const [attachment] = await query(
      `INSERT INTO attachments (task_id, uploader_id, filename, original_name, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, filename, original_name, mime_type, size_bytes, created_at`,
      [req.params.taskId, req.user!.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
    );
    await logActivity({ projectId, actorId: req.user!.id, verb: 'attached', entity: 'task', entityId: req.params.taskId, metadata: { name: req.file.originalname } });
    res.status(201).json({ attachment });
  })
);

// Download an attachment.
router.get(
  '/attachments/:attachmentId/download',
  asyncHandler(async (req, res) => {
    const row = await queryOne<{ filename: string; original_name: string; task_id: string }>(
      'SELECT filename, original_name, task_id FROM attachments WHERE id = $1',
      [req.params.attachmentId]
    );
    if (!row) throw new HttpError(404, 'Attachment not found');
    const projectId = await taskProject(row.task_id);
    await assertMember(projectId, req.user!.id);

    res.download(path.join(uploadRoot, row.filename), row.original_name);
  })
);

export default router;
