// Public content: homepage banners (MongoDB), delivery methods (PostgreSQL), newsletter signup (MongoDB)
import { Router } from 'express';
import { query } from '../config/postgres.js';
import { Banner } from '../models/Banner.js';
import { Subscriber } from '../models/Subscriber.js';
import { asyncHandler, logActivity, requireFields } from '../utils/helpers.js';

const router = Router();

// GET /api/banners  -> active slides for the homepage, in order
router.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    res.json(await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean());
  })
);

// GET /api/shipping-methods  -> active delivery options for checkout
router.get(
  '/shipping-methods',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT id, code, name, description, price FROM shipping_methods WHERE is_active ORDER BY sort_order, price, id'
    );
    res.json(rows);
  })
);

// POST /api/newsletter  { email }  -> subscribe (or re-subscribe) from the footer form
router.post(
  '/newsletter',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email']);
    const email = String(req.body.email).trim().toLowerCase();
    const existing = await Subscriber.findOne({ email });
    if (existing?.status === 'subscribed') return res.json({ message: "You're already subscribed." });

    if (existing) {
      existing.status = 'subscribed';
      await existing.save();
    } else {
      await Subscriber.create({ email, source: 'footer' });
    }
    await logActivity(req, 'newsletter.subscribed', { email });
    res.status(201).json({ message: "Thanks! You're on the list." });
  })
);

export default router;
