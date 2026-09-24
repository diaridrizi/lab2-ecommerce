// Admin CRUD: delivery methods (PostgreSQL)
import { Router } from 'express';
import { query } from '../config/postgres.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields, slugify } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function methodValues(body) {
  const price = Number(body.price ?? 0);
  if (!(price >= 0)) throw new HttpError(400, 'Price must be 0 or more');
  const name = String(body.name).trim();
  return [
    slugify(body.code || name),
    name,
    String(body.description ?? '').trim(),
    price,
    body.is_active ?? true,
    Number(body.sort_order) || 0,
  ];
}

// GET /api/admin/shipping-methods  -> all, with how many orders used each one
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT m.*, (SELECT COUNT(*)::int FROM orders o WHERE o.shipping_method = m.code) AS order_count
       FROM shipping_methods m ORDER BY m.sort_order, m.price, m.id`
    );
    res.json(rows);
  })
);

// POST /api/admin/shipping-methods  { name, code?, description, price, is_active, sort_order }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name']);
    const { rows } = await query(
      `INSERT INTO shipping_methods (code, name, description, price, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      methodValues(req.body)
    );
    await logActivity(req, 'admin.shipping_created', { code: rows[0].code });
    res.status(201).json(rows[0]);
  })
);

// PUT /api/admin/shipping-methods/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name']);
    const { rows } = await query(
      `UPDATE shipping_methods SET code = $1, name = $2, description = $3, price = $4, is_active = $5, sort_order = $6
       WHERE id = $7 RETURNING *`,
      [...methodValues(req.body), Number(req.params.id)]
    );
    if (!rows[0]) throw new HttpError(404, 'Delivery method not found');
    await logActivity(req, 'admin.shipping_updated', { code: rows[0].code });
    res.json(rows[0]);
  })
);

// DELETE /api/admin/shipping-methods/:id  (old orders keep their own copy of name and price)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows: active } = await query('SELECT COUNT(*)::int AS n FROM shipping_methods WHERE is_active AND id <> $1', [
      Number(req.params.id),
    ]);
    if (active[0].n === 0) throw new HttpError(400, 'Keep at least one active delivery method, or customers cannot check out');
    const { rowCount } = await query('DELETE FROM shipping_methods WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, 'Delivery method not found');
    await logActivity(req, 'admin.shipping_deleted', { id: Number(req.params.id) });
    res.status(204).end();
  })
);

export default router;
