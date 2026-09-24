// MongoDB model: newsletter subscribers (footer "Stay in the loop" form).
import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email address is not valid'],
    },
    name: { type: String, trim: true, maxlength: 100, default: '' },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    source: { type: String, default: 'footer' }, // 'footer' or 'admin'
  },
  { timestamps: true }
);

export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
