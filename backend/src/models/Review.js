// MongoDB model: product reviews.
// A review is a self-contained document (rating + text + author name) that is read together
// with the product page; the productId/userId point to rows in PostgreSQL.
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: Number, required: true, index: true }, // products.id in PostgreSQL
    userId: { type: Number, required: true },                 // users.id in PostgreSQL
    userName: { type: String, required: true },               // copied so we don't need a join to show it
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

// One review per customer per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
