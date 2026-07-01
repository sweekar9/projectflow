import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/asyncHandler';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, name, password } = req.body as z.infer<typeof registerSchema>;

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) throw new HttpError(409, 'Email already registered');

    const passwordHash = await hashPassword(password);
    const [user] = await query<{ id: string; email: string; name: string }>(
      'INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email, name, passwordHash]
    );

    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user });
  })
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await queryOne<{ id: string; email: string; name: string; password_hash: string }>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (!user) throw new HttpError(401, 'Invalid credentials');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Invalid credentials');

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await queryOne(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user });
  })
);

export default router;
