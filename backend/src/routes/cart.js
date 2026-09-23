// Cart routes. The cart lives in MongoDB; product details come from PostgreSQL.
import { Router } from 'express';
import { Cart } from '../models/Cart.js';
import { query } from '../config/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth);

// Combine the Mongo cart with fresh product data (name, price, stock) from Postgres
export async function buildCartResponse(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  const items = cart?.items ?? [];
  if (items.length === 0) return { items: [], subtotal: 0, count: 0 };

  const ids = items.map((i) => i.productId);
  const { rows } = await query(
    'SELECT id, name, slug, price, stock, image_url FROM products WHERE id = ANY($1) AND is_active',
    [ids]
  );
  const byId = new Map(rows.map((p) => [p.id, p]));

  const detailed = items
    .filter((i) => byId.has(i.productId)) // skip products that were deleted
    .map((i) => {
      const p = byId.get(i.productId);
      return { productId: p.id, name: p.name, slug: p.slug, price: p.price, stock: p.stock,
        image_url: p.image_url, quantity: i.quantity, lineTotal: +(p.price * i.quantity).toFixed(2) };
    });

  const subtotal = +detailed.reduce((s, i) => s + i.lineTotal, 0).toFixed(2);
  const count = detailed.reduce((s, i) => s + i.quantity, 0);
  return { items: detailed, subtotal, count };
}

async function getProductOr404(productId) {
  const { rows } = await query('SELECT id, stock FROM products WHERE id = $1 AND is_active', [productId]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  return rows[0];
}

// GET /api/cart
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await buildCartResponse(req.user.id));
  })
);

// POST /api/cart/items  { productId, quantity }  -> adds to existing quantity
router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    const product = await getProductOr404(productId);

    const cart = (await Cart.findOne({ userId: req.user.id })) || new Cart({ userId: req.user.id });
    const existing = cart.items.find((i) => i.productId === productId);
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stock) throw new HttpError(400, `Only ${product.stock} in stock`);

    if (existing) existing.quantity = newQty;
    else cart.items.push({ productId, quantity });
    await cart.save();

    await logActivity(req, 'cart.add', { productId, quantity });
    res.status(201).json(await buildCartResponse(req.user.id));
  })
);

// PATCH /api/cart/items/:productId  { quantity }  -> sets quantity
router.patch(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, 'Quantity must be 1 or more');
    const product = await getProductOr404(productId);
    if (quantity > product.stock) throw new HttpError(400, `Only ${product.stock} in stock`);

    const cart = await Cart.findOne({ userId: req.user.id });
    const item = cart?.items.find((i) => i.productId === productId);
    if (!item) throw new HttpError(404, 'Item not in cart');
    item.quantity = quantity;
    await cart.save();
    res.json(await buildCartResponse(req.user.id));
  })
);

// DELETE /api/cart/items/:productId
router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    await Cart.updateOne({ userId: req.user.id }, { $pull: { items: { productId } } });
    await logActivity(req, 'cart.remove', { productId });
    res.json(await buildCartResponse(req.user.id));
  })
);

// DELETE /api/cart  -> empty the cart
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
    res.json({ items: [], subtotal: 0, count: 0 });
  })
);

export default router;
