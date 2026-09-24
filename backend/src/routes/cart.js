// Cart routes. The cart lives in MongoDB; product details come from PostgreSQL.
// A cart line is identified by productId + size (the same shoe in two sizes = two lines).
import { Router } from 'express';
import { Cart } from '../models/Cart.js';
import { query } from '../config/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth);

const sameLine = (item, productId, size) => item.productId === productId && (item.size ?? null) === (size ?? null);

// Combine the Mongo cart with fresh product data (name, price, stock per size) from Postgres
export async function buildCartResponse(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  const items = cart?.items ?? [];
  if (items.length === 0) return { items: [], subtotal: 0, count: 0 };

  const ids = [...new Set(items.map((i) => i.productId))];
  const [products, sizes] = await Promise.all([
    query('SELECT id, name, slug, brand, price, compare_at_price, stock, image_url FROM products WHERE id = ANY($1) AND is_active', [ids]),
    query('SELECT product_id, size, stock FROM product_sizes WHERE product_id = ANY($1)', [ids]),
  ]);
  const byId = new Map(products.rows.map((p) => [p.id, p]));
  const sizeStock = new Map(sizes.rows.map((s) => [`${s.product_id}:${s.size}`, s.stock]));

  const detailed = items
    .filter((i) => byId.has(i.productId)) // skip products that were deleted
    .map((i) => {
      const p = byId.get(i.productId);
      const stock = i.size ? sizeStock.get(`${p.id}:${i.size}`) ?? 0 : p.stock;
      return {
        key: `${p.id}:${i.size ?? ''}`, productId: p.id, size: i.size ?? null,
        name: p.name, slug: p.slug, brand: p.brand, price: p.price, compare_at_price: p.compare_at_price,
        stock, image_url: p.image_url, quantity: i.quantity, lineTotal: +(p.price * i.quantity).toFixed(2),
      };
    });

  const subtotal = +detailed.reduce((s, i) => s + i.lineTotal, 0).toFixed(2);
  const count = detailed.reduce((s, i) => s + i.quantity, 0);
  return { items: detailed, subtotal, count };
}

// Returns how many of this product (in this size) can be bought.
// Sized products require a valid size; one-size products must not get one.
async function availableStock(productId, size) {
  const { rows } = await query('SELECT id, stock FROM products WHERE id = $1 AND is_active', [productId]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');

  const sizes = await query('SELECT size, stock FROM product_sizes WHERE product_id = $1', [productId]);
  if (sizes.rows.length === 0) {
    if (size) throw new HttpError(400, 'This product has no sizes');
    return rows[0].stock;
  }
  if (!size) throw new HttpError(400, 'Please choose a size');
  const match = sizes.rows.find((s) => s.size === size);
  if (!match) throw new HttpError(400, `Size ${size} does not exist for this product`);
  return match.stock;
}

const sizeParam = (value) => (value === undefined || value === null || value === '' ? null : String(value));

// GET /api/cart
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await buildCartResponse(req.user.id));
  })
);

// POST /api/cart/items  { productId, size, quantity }  -> adds to existing quantity
router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const productId = Number(req.body.productId);
    const size = sizeParam(req.body.size);
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    const stock = await availableStock(productId, size);

    const cart = (await Cart.findOne({ userId: req.user.id })) || new Cart({ userId: req.user.id });
    const existing = cart.items.find((i) => sameLine(i, productId, size));
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > stock) {
      throw new HttpError(400, stock === 0 ? 'This size is sold out' : `Only ${stock} in stock${size ? ` in size ${size}` : ''}`);
    }

    if (existing) existing.quantity = newQty;
    else cart.items.push({ productId, size, quantity });
    await cart.save();

    await logActivity(req, 'cart.add', { productId, size, quantity });
    res.status(201).json(await buildCartResponse(req.user.id));
  })
);

// PATCH /api/cart/items/:productId?size=42  { quantity }  -> sets quantity
router.patch(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const size = sizeParam(req.query.size);
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, 'Quantity must be 1 or more');
    const stock = await availableStock(productId, size);
    if (quantity > stock) throw new HttpError(400, `Only ${stock} in stock${size ? ` in size ${size}` : ''}`);

    const cart = await Cart.findOne({ userId: req.user.id });
    const item = cart?.items.find((i) => sameLine(i, productId, size));
    if (!item) throw new HttpError(404, 'Item not in cart');
    item.quantity = quantity;
    await cart.save();
    res.json(await buildCartResponse(req.user.id));
  })
);

// DELETE /api/cart/items/:productId?size=42
router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const size = sizeParam(req.query.size);
    await Cart.updateOne({ userId: req.user.id }, { $pull: { items: { productId, size } } });
    await logActivity(req, 'cart.remove', { productId, size });
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
