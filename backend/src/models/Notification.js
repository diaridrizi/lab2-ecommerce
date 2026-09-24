// MongoDB model: notifications shown in the bell menu. Sent live over WebSockets and saved here,
// so users also see what happened while they were offline. Deleted automatically after 90 days.
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },   // PostgreSQL users.id
    type: { type: String, required: true },                  // 'order.shipped', 'order.new', 'stock.low', ...
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '' },                     // page to open on click, e.g. '/orders/12'
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);
