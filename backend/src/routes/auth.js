import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/postgres.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const { name, email, password } = req.body;
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

    const hash = await bcrypt.hash(password, 10);
    // New accounts are always customers. Admins are created by the seed script.
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, LOWER($2), $3)
       RETURNING id, name, email, role`,
      [name.trim(), email.trim(), hash]
    );
    const user = rows[0];
    await logActivity(req, 'user.register', { userId: user.id });
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const { rows } = await query('SELECT * FROM users WHERE email = LOWER($1)', [
      req.body.email.trim(),
    ]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(req.body.password, user.password_hash));
    if (!ok) {
      await logActivity(req, 'user.login_failed', { email: req.body.email });
      throw new HttpError(401, 'Wrong email or password');
    }
    await logActivity(req, 'user.login', { userId: user.id });
    res.json({ user: publicUser(user), token: signToken(user) });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (!rows[0]) throw new HttpError(404, 'User not found');
    res.json({ user: rows[0] });
  })
);

export default router;
