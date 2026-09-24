// MongoDB model: one cart document per user.
// A cart is a good fit for NoSQL: it's a single nested document that
// changes often and doesn't need joins or transactions until checkout.
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: Number, required: true }, // id of the product in PostgreSQL
    size: { type: String, default: null }, // null for one-size products
    quantity: { type: Number, required: true, min: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, unique: true }, // id of the user in PostgreSQL
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

export const Cart = mongoose.model('Cart', cartSchema);
