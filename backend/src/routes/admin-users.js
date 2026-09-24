// Admin CRUD: users (PostgreSQL)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../config/postgres.js';
import { Cart } from '../models/Cart.js';
import { Review } from '../models/Review.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';
import { restock } from './orders.js';
import { Notification } from '../models/Notification.js';
import { validatePassword } from '../utils/password.js';
import { bumpTokenVersion, revokeAllSessions } from '../utils/tokens.js';
import { disconnectUser } from '../realtime/socket.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const ROLES = ['customer', 'admin'];

function userFields(body, { passwordRequired }) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role || 'customer';
  const password = body.password ? String(body.password) : '';
  if (!name) throw new HttpError(400, 'Name is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Email address is not valid');
  if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(', ')}`);
  if (passwordRequired && !password) throw new HttpError(400, 'Password is required');
  if (password) validatePassword(password);
  return { name, email, role, password };
}

// Stops the admin from locking everyone out
async function assertAnotherAdminExists(userId) {
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND id <> $1", [userId]);
  if (rows[0].n === 0) throw new HttpError(400, 'There must be at least one admin');
}

// GET /api/admin/users?search=&role=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (req.query.role) {
      params.push(req.query.role);
      where.push(`u.role = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              COUNT(o.id)::int AS order_count,
              COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS total_spent
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       GROUP BY u.id ORDER BY u.id`,
      params
    );
    res.json(rows);
  })
);

// POST /api/admin/users  { name, email, password, role }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const u = userFields(req.body, { passwordRequired: true });
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [u.name, u.email, await bcrypt.hash(u.password, 12), u.role]
    );
    await logActivity(req, 'admin.user_created', { targetUserId: rows[0].id });
    res.status(201).json(rows[0]);
  })
);

// PUT /api/admin/users/:id  { name, email, role, password? }  (empty password = keep the current one)
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const u = userFields(req.body, { passwordRequired: false });
    if (u.role !== 'admin') await assertAnotherAdminExists(id);
    const hash = u.password ? await bcrypt.hash(u.password, 12) : null;
    const { rows: before } = await query('SELECT role FROM users WHERE id = $1', [id]);
    if (!before[0]) throw new HttpError(404, 'User not found');
    const { rows } = await query(
      `UPDATE users SET name = $1, email = $2, role = $3, password_hash = COALESCE($4, password_hash)
       WHERE id = $5 RETURNING id, name, email, role, created_at`,
      [u.name, u.email, u.role, hash, id]
    );
    if (hash) {
      // New password set by the admin: log the user out everywhere
      await revokeAllSessions(id, 'admin');
      disconnectUser(id, 'password_reset');
    } else if (before[0].role !== u.role) {
      // Role changed: old access tokens stop working now; the user's next refresh gets the new role
      await bumpTokenVersion(id);
      disconnectUser(id);
    }
    await logActivity(req, 'admin.user_updated', { targetUserId: id, roleChanged: before[0].role !== u.role });
    res.json(rows[0]);
  })
);

// DELETE /api/admin/users/:id  -> also deletes their orders (FK cascade), cart and reviews
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, "You can't delete your own account");
    await assertAnotherAdminExists(id);

    await withTransaction(async (client) => {
      // Give back stock for orders that were never delivered or cancelled, before they are removed
      const { rows: open } = await client.query(
        "SELECT id FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'delivered')", [id]
      );
      for (const o of open) await restock(client, o.id);
      const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [id]);
      if (!rowCount) throw new HttpError(404, 'User not found');
    });
    // Refresh tokens are removed by ON DELETE CASCADE; close open WebSocket connections too
    disconnectUser(id, 'account_deleted');
    await Promise.all([Cart.deleteOne({ userId: id }), Review.deleteMany({ userId: id }), Notification.deleteMany({ userId: id })]);
    await logActivity(req, 'admin.user_deleted', { targetUserId: id });
    res.status(204).end();
  })
);

export default router;
