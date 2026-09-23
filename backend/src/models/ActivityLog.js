// MongoDB model: activity / event log.
// Every event can carry a different "meta" shape (semi-structured data),
// which is exactly what a document database handles well.
import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: Number, default: null },
    action: { type: String, required: true, index: true }, // e.g. 'user.login', 'order.created'
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
