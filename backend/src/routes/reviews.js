// Product reviews (MongoDB). Anyone can read them; logged-in customers write, edit and delete their own.
// Admins can delete any review (see also routes/admin-content.js for the admin list).
import { Router } from 'express';
import { query } from '../config/postgres.js';
import { Review } from '../models/Review.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity } from '../utils/helpers.js';
import { notifyAdmins } from '../utils/notify.js';

const router = Router();

function reviewFields(body) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be 1 to 5 stars');
  return { rating, title: String(body.title ?? '').trim(), body: String(body.body ?? '').trim() };
}

async function findOwnReview(req) {
  const review = await Review.findById(req.params.id);
  if (!review) throw new HttpError(404, 'Review not found');
  if (review.userId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'You can only change your own review');
  return review;
}

// GET /api/reviews?productId=3  -> reviews + average, using a MongoDB aggregation for the stats
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const productId = Number(req.query.productId);
    if (!productId) throw new HttpError(400, 'productId is required');
    const [reviews, stats] = await Promise.all([
      Review.find({ productId }).sort({ createdAt: -1 }).lean(),
      Review.aggregate([
        { $match: { productId } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);
    const count = stats.reduce((s, r) => s + r.count, 0);
    const average = count ? +(stats.reduce((s, r) => s + r._id * r.count, 0) / count).toFixed(1) : 0;
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: stats.find((r) => r._id === stars)?.count ?? 0 }));
    res.json({ reviews, count, average, breakdown });
  })
);

// POST /api/reviews  { productId, rating, title, body }
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const productId = Number(req.body.productId);
    const { rows } = await query('SELECT id, name FROM products WHERE id = $1 AND is_active', [productId]);
    if (!rows[0]) throw new HttpError(404, 'Product not found');
    if (await Review.exists({ productId, userId: req.user.id })) {
      throw new HttpError(409, 'You already reviewed this product — edit your review instead');
    }
    const review = await Review.create({ productId, userId: req.user.id, userName: req.user.name, ...reviewFields(req.body) });
    await logActivity(req, 'review.created', { productId, rating: review.rating });
    notifyAdmins({
      type: 'review.new', title: `New ${review.rating}★ review`,
      message: `${req.user.name} on "${rows[0].name}": ${review.title || review.body?.slice(0, 80) || ''}`, link: '/admin/reviews',
    });
    res.status(201).json(review);
  })
);

// PUT /api/reviews/:id  { rating, title, body }
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const review = await findOwnReview(req);
    Object.assign(review, reviewFields(req.body));
    await review.save();
    await logActivity(req, 'review.updated', { reviewId: review.id });
    res.json(review);
  })
);

// DELETE /api/reviews/:id
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const review = await findOwnReview(req);
    await review.deleteOne();
    await logActivity(req, 'review.deleted', { reviewId: review.id, productId: review.productId });
    res.status(204).end();
  })
);

export default router;
