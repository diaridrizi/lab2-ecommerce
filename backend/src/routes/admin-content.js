// Admin CRUD for MongoDB content: banners, newsletter subscribers, reviews
import { Router } from 'express';
import { query } from '../config/postgres.js';
import { Banner } from '../models/Banner.js';
import { Subscriber } from '../models/Subscriber.js';
import { Review } from '../models/Review.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const pick = (body, keys) => Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
const orNotFound = (doc, what) => {
  if (!doc) throw new HttpError(404, `${what} not found`);
  return doc;
};

// ---------- Banners ----------
const BANNER_FIELDS = ['title', 'eyebrow', 'text', 'image', 'ctaLabel', 'ctaLink', 'sortOrder', 'isActive'];

// GET /api/admin/banners  -> all banners, including hidden ones
router.get('/banners', asyncHandler(async (_req, res) => {
  res.json(await Banner.find().sort({ sortOrder: 1, createdAt: 1 }).lean());
}));

// POST /api/admin/banners  -> new banner goes to the end
router.post('/banners', asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'image']);
  const last = await Banner.findOne().sort({ sortOrder: -1 }).lean();
  const banner = await Banner.create({ sortOrder: (last?.sortOrder ?? -1) + 1, ...pick(req.body, BANNER_FIELDS) });
  await logActivity(req, 'admin.banner_created', { bannerId: banner.id });
  res.status(201).json(banner);
}));

// PUT /api/admin/banners/:id
router.put('/banners/:id', asyncHandler(async (req, res) => {
  const banner = orNotFound(
    await Banner.findByIdAndUpdate(req.params.id, pick(req.body, BANNER_FIELDS), { new: true, runValidators: true }),
    'Banner'
  );
  await logActivity(req, 'admin.banner_updated', { bannerId: banner.id });
  res.json(banner);
}));

// DELETE /api/admin/banners/:id
router.delete('/banners/:id', asyncHandler(async (req, res) => {
  orNotFound(await Banner.findByIdAndDelete(req.params.id), 'Banner');
  await logActivity(req, 'admin.banner_deleted', { bannerId: req.params.id });
  res.status(204).end();
}));

// ---------- Newsletter subscribers ----------
const SUBSCRIBER_FIELDS = ['email', 'name', 'status'];

// GET /api/admin/subscribers?search=&status=
router.get('/subscribers', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const re = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // escape user input
    filter.$or = [{ email: re }, { name: re }];
  }
  res.json(await Subscriber.find(filter).sort({ createdAt: -1 }).lean());
}));

// POST /api/admin/subscribers  { email, name, status }
router.post('/subscribers', asyncHandler(async (req, res) => {
  requireFields(req.body, ['email']);
  const subscriber = await Subscriber.create({ ...pick(req.body, SUBSCRIBER_FIELDS), source: 'admin' });
  await logActivity(req, 'admin.subscriber_created', { email: subscriber.email });
  res.status(201).json(subscriber);
}));

// PUT /api/admin/subscribers/:id
router.put('/subscribers/:id', asyncHandler(async (req, res) => {
  const changes = pick(req.body, SUBSCRIBER_FIELDS);
  if (changes.email) changes.email = String(changes.email).trim().toLowerCase();
  const subscriber = orNotFound(
    await Subscriber.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }),
    'Subscriber'
  );
  res.json(subscriber);
}));

// DELETE /api/admin/subscribers/:id
router.delete('/subscribers/:id', asyncHandler(async (req, res) => {
  orNotFound(await Subscriber.findByIdAndDelete(req.params.id), 'Subscriber');
  await logActivity(req, 'admin.subscriber_deleted', { subscriberId: req.params.id });
  res.status(204).end();
}));

// ---------- Reviews ----------
// GET /api/admin/reviews?rating=  -> all reviews with product names from PostgreSQL
router.get('/reviews', asyncHandler(async (req, res) => {
  const filter = req.query.rating ? { rating: Number(req.query.rating) } : {};
  const reviews = await Review.find(filter).sort({ createdAt: -1 }).lean();
  const ids = [...new Set(reviews.map((r) => r.productId))];
  const { rows } = ids.length ? await query('SELECT id, name, slug FROM products WHERE id = ANY($1)', [ids]) : { rows: [] };
  const byId = new Map(rows.map((p) => [p.id, p]));
  res.json(reviews.map((r) => ({ ...r, product: byId.get(r.productId) ?? null })));
}));

// PUT /api/admin/reviews/:id  { rating, title, body }  -> e.g. to remove bad language
router.put('/reviews/:id', asyncHandler(async (req, res) => {
  const review = orNotFound(
    await Review.findByIdAndUpdate(req.params.id, pick(req.body, ['rating', 'title', 'body']), { new: true, runValidators: true }),
    'Review'
  );
  await logActivity(req, 'admin.review_updated', { reviewId: review.id });
  res.json(review);
}));

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', asyncHandler(async (req, res) => {
  orNotFound(await Review.findByIdAndDelete(req.params.id), 'Review');
  await logActivity(req, 'admin.review_deleted', { reviewId: req.params.id });
  res.status(204).end();
}));

export default router;
