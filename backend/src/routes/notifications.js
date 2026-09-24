// My notifications (MongoDB). New ones also arrive live over the WebSocket ("notification" event).
import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/helpers.js';
import { emitToUser } from '../realtime/socket.js';

const router = Router();
router.use(requireAuth);

const unreadCount = (userId) => Notification.countDocuments({ userId, read: false });
// Tell the user's other tabs, so their badge stays in sync
const syncTabs = async (userId) => emitToUser(userId, 'notifications:sync', { unread: await unreadCount(userId) });

// GET /api/notifications?limit=20  -> { items, unread }
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const [items, unread] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit).lean(),
      unreadCount(req.user.id),
    ]);
    res.json({ items, unread });
  })
);

// PATCH /api/notifications/:id  { read: true|false }
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Notification not found');
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id }, // only your own
      { read: req.body.read !== false },
      { new: true }
    );
    if (!n) throw new HttpError(404, 'Notification not found');
    await syncTabs(req.user.id);
    res.json(n);
  })
);

// POST /api/notifications/read-all
router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    await syncTabs(req.user.id);
    res.json({ unread: 0 });
  })
);

// DELETE /api/notifications/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Notification not found');
    const { deletedCount } = await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!deletedCount) throw new HttpError(404, 'Notification not found');
    await syncTabs(req.user.id);
    res.status(204).end();
  })
);

// DELETE /api/notifications  -> clear all
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await Notification.deleteMany({ userId: req.user.id });
    await syncTabs(req.user.id);
    res.status(204).end();
  })
);

export default router;
