// Public catalog routes: categories and products
import { Router } from 'express';
import { query } from '../config/postgres.js';
import { asyncHandler, HttpError, logActivity } from '../utils/helpers.js';

const router = Router();

// GET /api/categories
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.name, c.slug, COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active
       GROUP BY c.id
       ORDER BY c.name`
    );
    res.json(rows);
  })
);

const SORTS = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  name: 'p.name ASC',
};

// GET /api/products?search=&category=&sort=&page=&limit=
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const orderBy = SORTS[req.query.sort] || SORTS.newest;

    // Build the WHERE clause with numbered parameters ($1, $2...) to prevent SQL injection
    const where = ['p.is_active'];
    const params = [];
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }
    if (req.query.category) {
      params.push(req.query.category);
      where.push(`c.slug = $${params.length}`);
    }
    const whereSql = where.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`,
      params
    );
    const total = countResult.rows[0].total;

    params.push(limit, (page - 1) * limit);
    const { rows } = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.stock, p.image_url,
              c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    if (req.query.search) await logActivity(req, 'product.search', { term: req.query.search });

    res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

// GET /api/products/:slug
router.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1 AND p.is_active`,
      [req.params.slug]
    );
    if (!rows[0]) throw new HttpError(404, 'Product not found');
    await logActivity(req, 'product.view', { productId: rows[0].id });
    res.json(rows[0]);
  })
);

export default router;
